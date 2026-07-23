import '../../node_modules/@majidh1/jalalidatepicker/dist/jalalidatepicker.min.css';
import '../../node_modules/@majidh1/jalalidatepicker/dist/jalalidatepicker.min.js';

const pad = (value) => String(value).padStart(2, '0');

const normalizeDigits = (value) => String(value || '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const gregorianToJalali = (gy, gm, gd) => {
    const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let year = gy - 1600;
    let month = gm - 1;
    let day = gd - 1;

    let gDayNo = (365 * year)
        + Math.floor((year + 3) / 4)
        - Math.floor((year + 99) / 100)
        + Math.floor((year + 399) / 400);

    for (let i = 0; i < month; i += 1) {
        gDayNo += gDaysInMonth[i];
    }

    if (month > 1 && ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0))) {
        gDayNo += 1;
    }

    gDayNo += day;

    let jDayNo = gDayNo - 79;
    const jNp = Math.floor(jDayNo / 12053);
    jDayNo %= 12053;

    let jy = 979 + (33 * jNp) + (4 * Math.floor(jDayNo / 1461));
    jDayNo %= 1461;

    if (jDayNo >= 366) {
        jy += Math.floor((jDayNo - 1) / 365);
        jDayNo = (jDayNo - 1) % 365;
    }

    let jm;
    let jd;

    if (jDayNo < 186) {
        jm = 1 + Math.floor(jDayNo / 31);
        jd = 1 + (jDayNo % 31);
    } else {
        jm = 7 + Math.floor((jDayNo - 186) / 30);
        jd = 1 + ((jDayNo - 186) % 30);
    }

    return [jy, jm, jd];
};

const jalaliToGregorian = (jy, jm, jd) => {
    const jDaysInMonth = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let year = jy - 979;
    let month = jm - 1;
    let day = jd - 1;

    let jDayNo = (365 * year) + (8 * Math.floor(year / 33)) + Math.floor(((year % 33) + 3) / 4);

    for (let i = 0; i < month; i += 1) {
        jDayNo += jDaysInMonth[i];
    }

    jDayNo += day;

    let gDayNo = jDayNo + 79;
    let gy = 1600 + (400 * Math.floor(gDayNo / 146097));
    gDayNo %= 146097;

    let leap = true;

    if (gDayNo >= 36525) {
        gDayNo -= 1;
        gy += 100 * Math.floor(gDayNo / 36524);
        gDayNo %= 36524;

        if (gDayNo >= 365) {
            gDayNo += 1;
        } else {
            leap = false;
        }
    }

    gy += 4 * Math.floor(gDayNo / 1461);
    gDayNo %= 1461;

    if (gDayNo >= 366) {
        leap = false;
        gDayNo -= 1;
        gy += Math.floor(gDayNo / 365);
        gDayNo %= 365;
    }

    let gm = 0;

    while (gDayNo >= gDaysInMonth[gm] + (gm === 1 && leap ? 1 : 0)) {
        gDayNo -= gDaysInMonth[gm] + (gm === 1 && leap ? 1 : 0);
        gm += 1;
    }

    const gd = gDayNo + 1;

    return [gy, gm + 1, gd];
};

const parseHiddenDateTime = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return null;
    }

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);
    if (!match) {
        return null;
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    };
};

const parseJalaliInput = (value) => {
    const raw = normalizeDigits(value).trim();
    if (!raw) {
        return null;
    }

    const match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!match) {
        return null;
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    };
};

const syncDisplayFromHidden = (displayInput, hiddenInput) => {
    const initial = parseHiddenDateTime(hiddenInput.value);
    if (!initial) {
        displayInput.value = '';
        return;
    }

    const [jy, jm, jd] = gregorianToJalali(initial.year, initial.month, initial.day);
    displayInput.value = `${jy}/${pad(jm)}/${pad(jd)}`;
};

const syncHiddenFromDisplay = (displayInput, hiddenInput, boundary) => {
    const parsed = parseJalaliInput(displayInput.value);
    if (!parsed) {
        hiddenInput.value = '';
        return;
    }

    const [gy, gm, gd] = jalaliToGregorian(parsed.year, parsed.month, parsed.day);
    const suffix = boundary === 'end' ? '23:59:59' : '00:00:00';
    hiddenInput.value = `${gy}-${pad(gm)}-${pad(gd)} ${suffix}`;
};

const connectDateInput = ({ displayId, hiddenId, boundary }) => {
    const displayInput = document.getElementById(displayId);
    const hiddenInput = document.getElementById(hiddenId);

    if (!displayInput || !hiddenInput) {
        return;
    }

    syncDisplayFromHidden(displayInput, hiddenInput);

    const sync = () => syncHiddenFromDisplay(displayInput, hiddenInput, boundary);

    displayInput.addEventListener('input', sync);
    displayInput.addEventListener('change', sync);
    displayInput.addEventListener('blur', sync);
};

document.addEventListener('DOMContentLoaded', () => {
    window.jalaliDatepicker?.startWatch({
        selector: 'input[data-jdp]',
        time: false,
        autoHide: true,
        hideAfterChange: true,
        showTodayBtn: true,
        showEmptyBtn: true,
        showCloseBtn: true,
        autoReadOnlyInput: false,
        persianDigits: true,
        zIndex: 2000,
    });

    connectDateInput({
        displayId: 'starts_at_display',
        hiddenId: 'starts_at',
        boundary: 'start',
    });

    connectDateInput({
        displayId: 'ends_at_display',
        hiddenId: 'ends_at',
        boundary: 'end',
    });
});
