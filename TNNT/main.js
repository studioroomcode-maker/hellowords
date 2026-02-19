document.addEventListener('DOMContentLoaded', () => {

    // 0. 테마 관리
    const themeToggle = document.getElementById('theme-toggle');

    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
    }

    themeToggle.addEventListener('click', toggleTheme);
    initTheme();

    // 1. 상태 관리 객체
    const state = {
        currentYear: 2026,
        currentMonth: 2,
        reservationData: JSON.parse(localStorage.getItem('tennisData')) || {},
        customModes: JSON.parse(localStorage.getItem('customModes')) || {},
        anniversaryData: JSON.parse(localStorage.getItem('anniversaryData')) || {},
        activeKey: null,
    };

    const timeSlots = ["08-10", "10-12", "12-14", "14-16", "16-18"];

    // 2. DOM 요소 캐싱
    const dom = {
        monthDisplay: document.getElementById('month-display'),
        subDateText: document.querySelector('.sub-date-text'),
        calendar: document.getElementById('calendar'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalTitle: document.getElementById('modal-title'),
        normalInputs: document.getElementById('normal-inputs'),
        customInputs: document.getElementById('custom-inputs'),
        anniInputs: document.getElementById('anni-inputs'),
        modalInput: document.getElementById('modal-input'),
        customTimeStart: document.getElementById('custom-time-start'),
        customTimeEnd: document.getElementById('custom-time-end'),
        customPlace: document.getElementById('custom-place'),
        customCourt: document.getElementById('custom-court'),
        anniInput: document.getElementById('anni-input'),
        checkSpecial: document.getElementById('check-special'),
        modalBtnContainer: document.getElementById('modal-btn-container'),
        captureArea: document.getElementById('capture-calendar-area'),
        fileInput: document.getElementById('fileInput'),
    };

    // 3. 이벤트 핸들러 바인딩
    function bindEvents() {
        document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
        document.getElementById('capture-calendar').addEventListener('click', captureCalendarImage);
        document.getElementById('capture-summary').addEventListener('click', captureSummaryImage);
        document.getElementById('copy-text').addEventListener('click', copyToClipboard);
        document.getElementById('download-excel').addEventListener('click', downloadExcel);
        document.getElementById('export-data').addEventListener('click', exportData);
        document.getElementById('import-data-btn').addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', importData);
    }

    // 4. 데이터 저장 함수
    function saveData() {
        localStorage.setItem('tennisData', JSON.stringify(state.reservationData));
        localStorage.setItem('customModes', JSON.stringify(state.customModes));
        localStorage.setItem('anniversaryData', JSON.stringify(state.anniversaryData));
        closeModal();
        renderCalendar();
    }

    // 5. 달력 렌더링 함수
    function renderCalendar() {
        dom.monthDisplay.innerText = `${state.currentYear}. ${String(state.currentMonth).padStart(2, '0')}`;
        dom.subDateText.innerText = `신정교 ${state.currentMonth}월 일정`;
        dom.calendar.innerHTML = '';

        ['일', '월', '화', '수', '목', '금', '토'].forEach((day, i) => {
            const div = document.createElement('div');
            div.className = `day-label ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`;
            div.innerText = day;
            dom.calendar.appendChild(div);
        });

        const firstDay = new Date(state.currentYear, state.currentMonth - 1, 1).getDay();
        const daysInMonth = new Date(state.currentYear, state.currentMonth, 0).getDate();
        for (let i = 0; i < firstDay; i++) dom.calendar.appendChild(document.createElement('div'));

        const holidays = getHolidays(state.currentYear);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${state.currentYear}-${state.currentMonth}-${d}`;
            const card = createDayCard(d, dateKey, holidays);
            dom.calendar.appendChild(card);
        }
    }
    
    function createDayCard(d, dateKey, holidays) {
        const holidayName = holidays[`${state.currentMonth}-${d}`];
        const anni = state.anniversaryData[dateKey] || { name: "", special: false };
        const isSpecialDay = holidayName === "창립기념일" || anni.special;
        const dateObj = new Date(state.currentYear, state.currentMonth - 1, d);
        const isSun = dateObj.getDay() === 0 || holidayName;
        const isSat = dateObj.getDay() === 6;
    
        const card = document.createElement('div');
        card.className = `day-card ${isSpecialDay ? 'special-day' : ''}`;
    
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
    
        const dateInfo = document.createElement('div');
        dateInfo.style.display = 'flex';
        dateInfo.style.alignItems = 'center';
        dateInfo.style.flexWrap = 'wrap';
    
        const dateNum = document.createElement('span');
        dateNum.className = `date-num ${isSun ? 'sun' : isSat ? 'sat' : ''}`;
        dateNum.innerText = `${d}일`;
        dateNum.addEventListener('click', () => openAnniModal(dateKey));
        dateInfo.appendChild(dateNum);
    
        if (holidayName) {
            const holidaySpan = document.createElement('span');
            holidaySpan.className = 'holiday-name sun';
            holidaySpan.innerText = `(${holidayName})`;
            dateInfo.appendChild(holidaySpan);
        }
        if (anni.name) {
            const anniSpan = document.createElement('span');
            anniSpan.className = 'anni-name';
            anniSpan.innerText = anni.name;
            dateInfo.appendChild(anniSpan);
        }
    
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-mode-btn';
        editBtn.innerText = '✎';
        editBtn.addEventListener('click', () => toggleMode(dateKey));
    
        dateHeader.appendChild(dateInfo);
        dateHeader.appendChild(editBtn);
        card.appendChild(dateHeader);
    
        if (state.customModes[dateKey]) {
            const container = document.createElement('div');
            container.className = 'custom-container';
            (state.reservationData[dateKey] || []).forEach((item, idx) => {
                const entry = document.createElement('div');
                entry.className = 'custom-entry';
                entry.style.backgroundColor = ['#ff7675', '#74b9ff', '#f9ca24'][idx % 3];
                entry.innerHTML = `<div class="custom-time-view">${item.time}</div><div>${item.place} / ${item.court}</div>`;
                entry.addEventListener('click', () => openCustomModal(dateKey, idx));
                container.appendChild(entry);
            });
            const addBtn = document.createElement('button');
            addBtn.className = 'custom-add-btn';
            addBtn.innerText = '+ 추가';
            addBtn.addEventListener('click', () => openCustomModal(dateKey, -1));
            container.appendChild(addBtn);
            card.appendChild(container);
        } else {
            timeSlots.forEach(time => {
                const row = document.createElement('div');
                row.className = 'court-row';
                const start = time.split('-')[0];
                row.innerHTML = `<span class="time-label">${start}시</span>`;
                for (let c = 1; c <= 3; c++) {
                    const btn = document.createElement('button');
                    btn.className = 'court-btn';
                    const key = `${dateKey}-${start}-${c}`;
                    if (state.reservationData[key]) {
                        btn.innerText = state.reservationData[key];
                        btn.classList.add('booked');
                    } else {
                        btn.innerText = `C${c}`;
                    }
                    btn.addEventListener('click', () => openNormalModal(key));
                    row.appendChild(btn);
                }
                card.appendChild(row);
            });
        }
        return card;
    }

    // 6. 월 변경 및 모드 토글
    function changeMonth(diff) {
        state.currentMonth += diff;
        if (state.currentMonth > 12) {
            state.currentMonth = 1;
            state.currentYear++;
        } else if (state.currentMonth < 1) {
            state.currentMonth = 12;
            state.currentYear--;
        }
        renderCalendar();
    }

    function toggleMode(dateKey) {
        state.customModes[dateKey] = !state.customModes[dateKey];
        saveData();
    }

    // 7. 모달 관련 함수
    function closeModal() {
        dom.modalOverlay.style.display = 'none';
    }

    function updateButtons(isEdit, saveFn, delFn) {
        dom.modalBtnContainer.innerHTML = `<button class="m-btn m-save" id="btn-save-act">저장</button>${isEdit ? `<button class="m-btn m-delete" id="btn-del-act">삭제</button>` : ''}<button class="m-btn m-cancel">취소</button>`;
        dom.modalBtnContainer.querySelector('#btn-save-act').addEventListener('click', saveFn);
        if (isEdit) {
            dom.modalBtnContainer.querySelector('#btn-del-act').addEventListener('click', delFn);
        }
        dom.modalBtnContainer.querySelector('.m-cancel').addEventListener('click', closeModal);
    }

    function openNormalModal(key) {
        state.activeKey = key;
        dom.modalTitle.innerText = "예약자 입력";
        dom.normalInputs.style.display = 'block';
        dom.customInputs.style.display = 'none';
        dom.anniInputs.style.display = 'none';
        dom.modalInput.value = state.reservationData[key] || "";
        updateButtons(!!state.reservationData[key], saveNormal, deleteNormal);
        dom.modalOverlay.style.display = 'flex';
        dom.modalInput.focus();
    }

    function saveNormal() {
        const val = dom.modalInput.value.trim();
        if (val) {
            state.reservationData[state.activeKey] = val.substring(0, 2);
        } else {
            delete state.reservationData[state.activeKey];
        }
        saveData();
    }

    function deleteNormal() {
        delete state.reservationData[state.activeKey];
        saveData();
    }

    function openCustomModal(dateKey, index) {
        state.activeKey = { dateKey, index };
        dom.modalTitle.innerText = "상세 입력";
        dom.normalInputs.style.display = 'none';
        dom.customInputs.style.display = 'block';
        dom.anniInputs.style.display = 'none';
        
        const dayData = state.reservationData[dateKey] || [];
        const item = index >= 0 ? dayData[index] : { time: '', place: '', court: '' };
        const timeMatch = item.time.match(/(\d+)시~(\d+)시/);
        dom.customTimeStart.value = timeMatch ? timeMatch[1] : "";
        dom.customTimeEnd.value = timeMatch ? timeMatch[2] : "";
        dom.customPlace.value = item.place;
        dom.customCourt.value = item.court;

        updateButtons(index >= 0, saveCustom, deleteCustom);
        dom.modalOverlay.style.display = 'flex';
    }

    function saveCustom() {
        const { dateKey, index } = state.activeKey;
        const start = dom.customTimeStart.value.trim();
        const end = dom.customTimeEnd.value.trim();
        const newItem = {
            time: (start && end) ? `${start}시~${end}시` : (start ? `${start}시` : ""),
            place: dom.customPlace.value.trim(),
            court: dom.customCourt.value.trim(),
        };
        
        if (!state.reservationData[dateKey]) state.reservationData[dateKey] = [];
        
        if (index >= 0) {
            state.reservationData[dateKey][index] = newItem;
        } else {
            state.reservationData[dateKey].push(newItem);
        }
        saveData();
    }

    function deleteCustom() {
        const { dateKey, index } = state.activeKey;
        state.reservationData[dateKey].splice(index, 1);
        if (state.reservationData[dateKey].length === 0) {
            delete state.reservationData[dateKey];
        }
        saveData();
    }

    function openAnniModal(dateKey) {
        state.activeKey = dateKey;
        dom.modalTitle.innerText = "강조 & 기념일 설정";
        dom.normalInputs.style.display = 'none';
        dom.customInputs.style.display = 'none';
        dom.anniInputs.style.display = 'block';
        
        const data = state.anniversaryData[dateKey] || { name: "", special: false };
        dom.anniInput.value = data.name;
        dom.checkSpecial.checked = data.special;
        
        updateButtons(!!state.anniversaryData[dateKey], saveAnni, deleteAnni);
        dom.modalOverlay.style.display = 'flex';
    }

    function saveAnni() {
        const name = dom.anniInput.value.trim();
        const special = dom.checkSpecial.checked;
        if (name || special) {
            state.anniversaryData[state.activeKey] = { name, special };
        } else {
            delete state.anniversaryData[state.activeKey];
        }
        saveData();
    }

    function deleteAnni() {
        delete state.anniversaryData[state.activeKey];
        saveData();
    }

    // 8. 기타 유틸리티 함수 (휴일 정보, 데이터 export 등)
    function getHolidays(year) {
        const solarHolidays = { "1-1":"신정", "3-1":"삼일절", "5-5":"어린이날", "6-6":"현충일", "8-15":"광복절", "10-3":"개천절", "10-9":"한글날", "12-25":"성탄절", "12-12":"창립기념일" };
        const lunarHolidays = {
            2025: { "1-28":"설날연휴", "1-29":"설날", "1-30":"설날연휴", "5-5":"부처님오신날", "10-5":"추석연휴", "10-6":"추석", "10-7":"추석연휴" },
            2026: { "2-16":"설날연휴", "2-17":"설날", "2-18":"설날연휴", "5-24":"부처님오신날", "9-24":"추석연휴", "9-25":"추석", "9-26":"추석연휴" }
        };
        let combined = { ...solarHolidays };
        if (lunarHolidays[year]) combined = { ...combined, ...lunarHolidays[year] };
        if (year === 2026) { combined["3-2"] = "대체공휴일"; combined["5-25"] = "대체공휴일"; combined["8-17"] = "대체공휴일"; combined["10-5"] = "대체공휴일"; }
        return combined;
    }

    async function captureCalendarImage() {
        const editButtons = dom.captureArea.querySelectorAll('.edit-mode-btn, .custom-add-btn');
        editButtons.forEach(btn => btn.style.visibility = 'hidden');
        const canvas = await html2canvas(dom.captureArea, { scale: 2 });
        editButtons.forEach(btn => btn.style.visibility = 'visible');
        const link = document.createElement('a');
        link.download = `한미모스_달력_${state.currentYear}_${state.currentMonth}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }

    async function captureSummaryImage() {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-capture-area';
        let contentHtml = `<div class="summary-header"><h1>한미모스 테니스 클럽</h1><p>신정교 ${state.currentMonth}월 일정</p></div>`;
        let hasData = false;
        const daysInMonth = new Date(state.currentYear, state.currentMonth, 0).getDate();
        for(let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${state.currentYear}-${state.currentMonth}-${d}`;
            let dayItems = "";
            if(state.customModes[dateKey]) {
                (state.reservationData[dateKey] || []).forEach(item => {
                    dayItems += `<li class="summary-item">[${item.time}] ${item.place} : ${item.court}</li>`;
                });
            } else {
                timeSlots.forEach(time => {
                    const start = time.split('-')[0];
                    let booked = [];
                    for(let c = 1; c <= 3; c++) {
                        const key = `${dateKey}-${start}-${c}`;
                        if(state.reservationData[key]) booked.push(`코트 ${c} : ${state.reservationData[key]}`);
                    }
                    if(booked.length > 0) {
                        booked.forEach(info => {
                            dayItems += `<li class="summary-item">[${start}시] ${info}</li>`;
                        });
                    }
                });
            }
            if(dayItems) {
                contentHtml += `<div class="summary-card"><div class="summary-date">${state.currentMonth}월 ${d}일</div><ul class="summary-list">${dayItems}</ul></div>`;
                hasData = true;
            }
        }
        if(!hasData) contentHtml += "<div class='summary-card' style='text-align:center;'>일정이 없습니다.</div>";
        summaryDiv.innerHTML = contentHtml;
        document.body.appendChild(summaryDiv);
        const canvas = await html2canvas(summaryDiv, { scale: 2, backgroundColor: "#ffffff" });
        const link = document.createElement('a');
        link.download = `한미모스_요약_${state.currentYear}_${state.currentMonth}.png`;
        link.href = canvas.toDataURL();
        link.click();
        document.body.removeChild(summaryDiv);
    }

    function copyToClipboard() {
        let text = `🎾 한미모스 테니스 클럽 ${state.currentMonth}월 일정\n\n`;
        const daysInMonth = new Date(state.currentYear, state.currentMonth, 0).getDate();
        let hasData = false;
        for(let d=1; d<=daysInMonth; d++) {
            const dateKey = `${state.currentYear}-${state.currentMonth}-${d}`;
            let dayText = "";
            if(state.customModes[dateKey]) {
                const entries = state.reservationData[dateKey] || [];
                entries.forEach(item => { dayText += `${state.currentMonth}/${d} [${item.time}] ${item.place} : ${item.court}\n`; });
            } else {
                timeSlots.forEach(time => {
                    const start = time.split('-')[0];
                    let bookedCourts = []; let names = [];
                    for(let c=1; c<=3; c++) {
                        const key = `${dateKey}-${start}-${c}`;
                        if(state.reservationData[key]) { bookedCourts.push(c); names.push(state.reservationData[key]); }
                    }
                    if(bookedCourts.length > 0) {
                        const uniqueNames = [...new Set(names)].join(',');
                        const courtNumbers = bookedCourts.join(',');
                        dayText += `${state.currentMonth}/${d} [${start}시] 코트${courtNumbers} : ${uniqueNames}\n`;
                    }
                });
            }
            if(dayText) { text += dayText; hasData = true; }
        }
        if(!hasData) text += "등록된 일정이 없습니다.";
        navigator.clipboard.writeText(text).then(() => alert("일정이 텍스트로 복사되었습니다!"));
    }

    function downloadExcel() {
        const daysInMonth = new Date(state.currentYear, state.currentMonth, 0).getDate();
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        let header = ["날짜", "요일"];
        timeSlots.forEach(time => {
            const hour = time.split('-')[0];
            for(let c = 1; c <= 3; c++) {
                header.push(`${hour}시(C${c})`);
            }
        });
        let rows = [header];
        for(let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${state.currentYear}-${state.currentMonth}-${d}`;
            const dateObj = new Date(state.currentYear, state.currentMonth - 1, d);
            const dayName = weekDays[dateObj.getDay()];
            let row = [`${state.currentMonth}/${d}`, dayName];
            if (state.customModes[dateKey]) {
                timeSlots.forEach(() => { for(let c=1; c<=3; c++) row.push("-"); });
            } else {
                timeSlots.forEach(time => {
                    const hour = time.split('-')[0];
                    for(let c = 1; c <= 3; c++) {
                        const key = `${dateKey}-${hour}-${c}`;
                        row.push(state.reservationData[key] || "-");
                    }
                });
            }
            rows.push(row);
        }
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "테니스 일정");
        XLSX.writeFile(workbook, `한미모스_일정_${state.currentYear}_${state.currentMonth}.xlsx`);
    }

    function exportData() {
        const now = new Date();
        const year = String(now.getFullYear()).substring(2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        let lastDate = localStorage.getItem('lastBackupDate');
        let version = parseInt(localStorage.getItem('lastBackupVersion')) || 0;
        if (lastDate === dateStr) {
            version += 1;
        } else {
            version = 1;
            localStorage.setItem('lastBackupDate', dateStr);
        }
        localStorage.setItem('lastBackupVersion', version);
        const versionStr = String(version).padStart(2, '0');
        const fileName = `한미모스_${dateStr}_v${versionStr}.json`;
        const dataStr = JSON.stringify({
            reservationData: state.reservationData,
            customModes: state.customModes,
            anniversaryData: state.anniversaryData
        });
        const link = document.createElement('a');
        link.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        link.download = fileName;
        link.click();
    }

    function importData(e) {
        const reader = new FileReader();
        reader.onload = (le) => { 
            const imported = JSON.parse(le.target.result);
            state.reservationData = imported.reservationData || {};
            state.customModes = imported.customModes || {};
            state.anniversaryData = imported.anniversaryData || {};
            saveData();
        };
        reader.readAsText(e.target.files[0]);
    }

    // 9. 초기화
    function init() {
        bindEvents();
        renderCalendar();
    }

    init();
});