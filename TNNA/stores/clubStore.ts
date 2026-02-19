import { create } from 'zustand';
import { Club, ClubSettings, ClubFeatureFlags, SubscriptionTier, AdminLevel, AdminPermissions } from '../types';
import * as clubService from '../services/clubs';
import { getUserRole, getAdminLevels, getClubTier, getTierFeatureConfig, getClubFeatureFlags, computeEffectiveFlags } from '../services/localData';
import { syncManager } from '../services/syncManager';

export type UserRole = 'superAdmin' | 'admin' | 'member' | null;

// 기본 권한 설정
const DEFAULT_PERMISSIONS: Record<number, AdminPermissions> = {
  1: { canAccessDues: true, canEditPlayers: true, canCreateSchedule: true, canInputScores: true },
  2: { canAccessDues: true, canEditPlayers: true, canCreateSchedule: true, canInputScores: true },
  3: { canAccessDues: false, canEditPlayers: false, canCreateSchedule: false, canInputScores: true },
};

interface ClubState {
  clubCode: string | null;
  club: Club | null;
  isAdmin: boolean;
  userRole: UserRole;
  adminLevel: AdminLevel | null;
  adminPermissions: AdminPermissions | null;
  isLoading: boolean;
  allClubs: { code: string; name: string }[];
  viewOverride: 'member' | null;
  subscriptionTier: SubscriptionTier | null;
  effectiveFlags: ClubFeatureFlags | null;

  // Actions
  setClubCode: (code: string | null) => void;
  loadClub: (code: string) => Promise<boolean>;
  loadAllClubs: () => Promise<void>;
  checkAdminStatus: (email: string) => Promise<void>;
  updateSettings: (settings: ClubSettings) => Promise<boolean>;
  setViewOverride: (override: 'member' | null) => void;
  clearClub: () => void;
  hasPermission: (perm: keyof AdminPermissions) => boolean;
  loadFeatureFlags: (clubCode: string) => Promise<void>;
  isFeatureDisabled: (feature: keyof ClubFeatureFlags) => boolean;
}

export const useClubStore = create<ClubState>()((set, get) => ({
  clubCode: null,
  club: null,
  isAdmin: false,
  userRole: null,
  adminLevel: null,
  adminPermissions: null,
  isLoading: false,
  allClubs: [],
  viewOverride: null,
  subscriptionTier: null,
  effectiveFlags: null,

  setClubCode: (code) => set({ clubCode: code?.toUpperCase() || null }),

  loadClub: async (code) => {
    set({ isLoading: true });
    try {
      const normalizedCode = code.toUpperCase();
      const club = await clubService.getClub(normalizedCode);

      if (club) {
        set({
          clubCode: normalizedCode,
          club,
          isLoading: false,
        });
        // 기능 플래그 로드
        get().loadFeatureFlags(normalizedCode);
        // 백그라운드에서 서버 동기화 (서버 비면 로컬→서버 push)
        syncManager.fullSync(normalizedCode).catch(e => console.warn('[Sync] fullSync error:', e));
        return true;
      } else {
        set({ isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('Error loading club:', error);
      set({ isLoading: false });
      return false;
    }
  },

  loadAllClubs: async () => {
    try {
      const clubs = await clubService.getAllClubs();
      set({ allClubs: clubs });
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  },

  checkAdminStatus: async (email) => {
    const { clubCode, club } = get();
    if (!clubCode || !email) {
      set({ isAdmin: false, userRole: null, adminLevel: null, adminPermissions: null });
      return;
    }

    try {
      const isAdmin = await clubService.isClubAdmin(clubCode, email);
      const role = getUserRole(email, clubCode);

      let level: AdminLevel | null = null;
      let perms: AdminPermissions | null = null;

      if (isAdmin) {
        // 관리자 레벨 로드
        const levels = await getAdminLevels(clubCode);
        const emailLower = email.toLowerCase();
        level = (levels[emailLower] as AdminLevel) || 1; // 기본 레벨1

        // 권한 결정
        const customPerms = club?.settings?.adminLevelPermissions;
        if (level === 1) {
          perms = DEFAULT_PERMISSIONS[1]; // 레벨1은 항상 모든 권한
        } else {
          perms = customPerms?.[level] || DEFAULT_PERMISSIONS[level] || DEFAULT_PERMISSIONS[2];
        }
      }

      // superAdmin은 항상 레벨1 권한
      if (role === 'superAdmin') {
        level = 1;
        perms = DEFAULT_PERMISSIONS[1];
      }

      set({ isAdmin, userRole: role, adminLevel: level, adminPermissions: perms });
    } catch (error) {
      console.error('Error checking admin status:', error);
      set({ isAdmin: false, userRole: null, adminLevel: null, adminPermissions: null });
    }
  },

  updateSettings: async (settings) => {
    const { clubCode, club } = get();
    if (!clubCode || !club) return false;

    try {
      const success = await clubService.updateClubSettings(clubCode, settings);
      if (success) {
        set({
          club: { ...club, settings },
        });
      }
      return success;
    } catch (error) {
      console.error('Error updating club settings:', error);
      return false;
    }
  },

  setViewOverride: (override) => {
    if (override === 'member') {
      set({ viewOverride: 'member', isAdmin: false, userRole: 'member', adminLevel: null, adminPermissions: null });
    } else {
      set({ viewOverride: null });
    }
  },

  clearClub: () => {
    set({
      clubCode: null,
      club: null,
      isAdmin: false,
      userRole: null,
      adminLevel: null,
      adminPermissions: null,
      viewOverride: null,
      subscriptionTier: null,
      effectiveFlags: null,
    });
  },

  hasPermission: (perm) => {
    const { isAdmin, adminPermissions, userRole } = get();
    if (!isAdmin) return false;
    if (userRole === 'superAdmin') return true;
    if (!adminPermissions) return true; // 레벨 없으면 기본 허용
    return adminPermissions[perm];
  },

  loadFeatureFlags: async (clubCode) => {
    try {
      const tier = await getClubTier(clubCode);
      const tierConfig = await getTierFeatureConfig();
      const clubOverrides = await getClubFeatureFlags(clubCode);
      const tierFlags = tierConfig[tier];
      const effective = computeEffectiveFlags(tierFlags, clubOverrides);
      set({ subscriptionTier: tier, effectiveFlags: effective });
    } catch (error) {
      console.error('Error loading feature flags:', error);
    }
  },

  isFeatureDisabled: (feature) => {
    const { effectiveFlags, userRole } = get();
    if (userRole === 'superAdmin') return false;
    if (!effectiveFlags) return false;
    return effectiveFlags[feature];
  },
}));
