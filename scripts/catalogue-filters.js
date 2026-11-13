/* Filters read the original art-song fields; they never rewrite source records. */
(function (root) {
    const voices = [
        ['soprano', '女高音 Soprano'], ['mezzo', '女中音 Mezzo-soprano'],
        ['alto', '低女聲 Alto / Contralto'], ['tenor', '男高音 Tenor'],
        ['baritone', '男中音 Baritone'], ['bass', '男低音 Bass']
    ];
    const instrumentLabels = {piano:'鋼琴 Piano', harp:'豎琴 Harp', percussion:'敲擊樂 Percussion', violin:'小提琴 Violin', cello:'大提琴 Cello', flute:'長笛 Flute', clarinet:'單簧管 Clarinet', dizi:'笛子 Dizi', erhu:'二胡 Erhu', zheng:'箏 Zheng', ensemble:'合奏 Ensemble'};
    const value = (row, key) => String(row[key] || '').trim();
    function voiceMatches(raw, voice) {
        const parts = raw.toLowerCase().split(/[/,+;]/).map(s => s.trim());
        return parts.some(part => voice === 'soprano' ? /\bsoprano\b/.test(part) && !/mezzo/.test(part)
            : voice === 'mezzo' ? /mezzo[ -]?soprano/.test(part)
            : voice === 'alto' ? /\b(?:alto|contralto)\b/.test(part) : new RegExp('\\b' + voice + '\\b').test(part));
    }
    function instruments(raw) {
        // Commas inside a named ensemble's parentheses describe that ensemble.
        return raw.toLowerCase().split(/[/+;]|,(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
    }
    function minutes(raw) {
        const match = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)?$/i);
        return match ? Number(match[1]) : null;
    }
    function matches(row, state) {
        const duration = minutes(value(row, 'Duration'));
        return (!state.voice.length || state.voice.some(v => voiceMatches(value(row, 'Voice Type'), v)))
            && (!state.instrument.length || state.instrument.some(v => instruments(value(row, 'Instrument(s)')).includes(v)))
            && (!state.composer.length || state.composer.includes(value(row, 'Composer (C)') + '\u0000' + value(row, 'Composer (E)')))
            && (!state.score || !!value(row, 'Perusal Score'))
            && (duration === null || (duration >= state.min && (state.max === 10 || duration <= state.max)));
    }
    function mount(container, rows, onChange) {
        const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'db-filter-toggle'; toggle.textContent = '篩選 Filters'; toggle.setAttribute('aria-controls',container.id); toggle.setAttribute('aria-expanded','false');
        container.before(toggle); container.classList.add('mobile-collapsed');
        toggle.addEventListener('click', () => { const collapsed = container.classList.toggle('mobile-collapsed'); toggle.setAttribute('aria-expanded',String(!collapsed)); });
        const state = {voice:[], instrument:[], composer:[], score:false, min:0, max:10};
        const element = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
        function group(title) { const box = element('fieldset'); box.append(element('legend', title)); container.append(box); return box; }
        function checkbox(box, labelText, action) {
            const label = element('label'); const input = element('input'); input.type = 'checkbox';
            input.addEventListener('change', () => { action(input.checked); onChange(); });
            label.append(input, element('span', labelText)); box.append(label); return input;
        }
        function options(box, category, entries) {
            entries.forEach(([key,label]) => checkbox(box, label, checked => {
                state[category] = checked ? [...state[category],key] : state[category].filter(v => v !== key);
            }));
        }
        const resources = group('可用資源 Available Resources');
        // Move the existing audio control; its label, ID and event handler stay intact.
        resources.append(document.getElementById('audioFilterCheckbox').closest('label'));
        checkbox(resources, '樂譜試閱 With Score', checked => state.score = checked);
        const duration = group('時長 Duration (min)');
        const output = element('output'); output.setAttribute('aria-live','polite'); duration.append(output);
        const track = element('div'); track.className = 'db-duration-track'; duration.append(track);
        const min = element('input'); const max = element('input');
        for (const [input,label,initial] of [[min,'最短時長 Minimum duration',0],[max,'最長時長 Maximum duration',10]]) {
            input.type = 'range'; input.min = '0'; input.max = '10'; input.step = '0.5'; input.value = initial;
            input.setAttribute('aria-label',label); track.append(input);
        }
        function updateDuration() { output.textContent = `${state.min}–${state.max === 10 ? '10+' : state.max}`; min.value = state.min; max.value = state.max; track.style.setProperty('--start', state.min * 10 + '%'); track.style.setProperty('--end', state.max * 10 + '%'); }
        min.addEventListener('input', () => { state.min = Math.min(Number(min.value),state.max); updateDuration(); onChange(); });
        max.addEventListener('input', () => { state.max = Math.max(Number(max.value),state.min); updateDuration(); onChange(); });
        updateDuration();
        options(group('聲部 Voice Type'),'voice',voices);
        const allInstruments = [...new Set(rows.flatMap(row => instruments(value(row,'Instrument(s)'))))].sort();
        options(group('伴奏 Accompaniment'),'instrument',allInstruments.map(v => [v,instrumentLabels[v] || v]));
        const composerBox = group('作曲家 Composer');
        const search = element('input'); search.type = 'search'; search.placeholder = '作曲家搜尋 Composer Search…'; search.setAttribute('aria-label',search.placeholder); composerBox.append(search);
        const list = element('div'); list.className = 'composer-options'; composerBox.append(list);
        const composers = new Map(rows.map(row => {
            const c = value(row,'Composer (C)'), e = value(row,'Composer (E)');
            return [c + '\u0000' + e,[c,e].filter(Boolean).join(' / ')];
        }).filter(([,label]) => label));
        options(list,'composer',[...composers].sort((a,b) => a[1].localeCompare(b[1],'zh-Hant')));
        search.addEventListener('input', () => { for (const label of list.children) label.hidden = !label.textContent.toLowerCase().includes(search.value.trim().toLowerCase()); });
        return {matches:row => matches(row,state), reset() {
            Object.assign(state,{voice:[],instrument:[],composer:[],score:false,min:0,max:10});
            container.querySelectorAll('input[type=checkbox]').forEach(input => input.checked = false);
            search.value = ''; for (const label of list.children) label.hidden = false;
            updateDuration();
        }};
    }
    const api = {mount, matches, minutes, instruments, voiceMatches};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CatalogueFilters = api;
})(globalThis);
