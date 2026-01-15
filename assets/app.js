/* DTT記録ツール（フルパックデザイン復元・安定版）
   - index_aba_fullpack.html の見た目をそのまま使う
   - JSだけを“壊れない構造”に差し替え
*/
(function(){
  "use strict";

  // Storage keys (旧版と同じ)
  const STORAGE_KEY_SESSIONS   = "ABA_SCHPASS_SESSIONS_V6";
  const STORAGE_KEY_STUDENTS   = "ABA_SCHPASS_STUDENTS_V6";
  const STORAGE_KEY_TEACHERS   = "ABA_SCHPASS_TEACHERS_V6";
  const STORAGE_KEY_TASKS      = "ABA_SCHPASS_TASKS_V6";
  const STORAGE_KEY_TARGETS    = "ABA_SCHPASS_TARGETS_V6";
  const STORAGE_KEY_TARGET_SD   = "ABA_SCHPASS_TARGET_SD_V1";
  const STORAGE_KEY_TASK_TARGETS = "ABA_SCHPASS_TASK_TARGETS_V1";
  const STORAGE_KEY_REINFORCERS= "ABA_SCHPASS_REINFORCERS_V6";

  const VERSION = "design-restore-stable-v1";

  let sessions = [];
  let appSettings = { facilityName: "" , showArchived: false };
  let archiveStore = { students: [], teachers: [], tasks: [], targets: [], reinforcers: [] };
  let students = [];
  let teachers = [];
  let tasks = [];
  let targets = [];
  let reinforcers = [];
  let targetSdMap = {}; // { [targetName]: sdText }
  let taskTargetsMap = {}; // { [taskName]: [targetName, ...] }
  let currentTrials = [];

  function $(id){ return document.getElementById(id); }

  function safeGet(key, fallback){
    try{
      const v = localStorage.getItem(key);
      if(v === null || v === undefined) return fallback;
      const parsed = JSON.parse(v);
      return parsed ?? fallback;
    }

  // --- Legacy data migration (v11) ---
  function migrateLegacyData(){
    // If current V6 keys are empty, try to load from older keys (V1-V5) and promote to V6.
    const fallbacks = {
      tasks: ["ABA_SCHPASS_TASKS_V5","ABA_SCHPASS_TASKS_V4","ABA_SCHPASS_TASKS_V3","ABA_SCHPASS_TASKS_V2","ABA_SCHPASS_TASKS_V1","ABA_SCHPASS_TASKS"],
      targets: ["ABA_SCHPASS_TARGETS_V5","ABA_SCHPASS_TARGETS_V4","ABA_SCHPASS_TARGETS_V3","ABA_SCHPASS_TARGETS_V2","ABA_SCHPASS_TARGETS_V1","ABA_SCHPASS_TARGETS"],
      students: ["ABA_SCHPASS_STUDENTS_V5","ABA_SCHPASS_STUDENTS_V4","ABA_SCHPASS_STUDENTS_V3","ABA_SCHPASS_STUDENTS_V2","ABA_SCHPASS_STUDENTS_V1","ABA_SCHPASS_STUDENTS"],
      teachers: ["ABA_SCHPASS_TEACHERS_V5","ABA_SCHPASS_TEACHERS_V4","ABA_SCHPASS_TEACHERS_V3","ABA_SCHPASS_TEACHERS_V2","ABA_SCHPASS_TEACHERS_V1","ABA_SCHPASS_TEACHERS"],
      reinforcers: ["ABA_SCHPASS_REINFORCERS_V5","ABA_SCHPASS_REINFORCERS_V4","ABA_SCHPASS_REINFORCERS_V3","ABA_SCHPASS_REINFORCERS_V2","ABA_SCHPASS_REINFORCERS_V1","ABA_SCHPASS_REINFORCERS"],
      sessions: ["ABA_SCHPASS_SESSIONS_V5","ABA_SCHPASS_SESSIONS_V4","ABA_SCHPASS_SESSIONS_V3","ABA_SCHPASS_SESSIONS_V2","ABA_SCHPASS_SESSIONS_V1","ABA_SCHPASS_SESSIONS"]
    };

    function pickFirstArray(keys){
      for(const k of keys){
        const v = safeGet(k, null);
        if(Array.isArray(v) && v.length) return v;
      }
      return null;
    }

    let changed = false;

    if(Array.isArray(tasks) && tasks.length === 0){
      const v = pickFirstArray(fallbacks.tasks);
      if(v){ tasks = v; changed = true; }
    }
    if(Array.isArray(targets) && targets.length === 0){
      const v = pickFirstArray(fallbacks.targets);
      if(v){ targets = v; changed = true; }
    }
    if(Array.isArray(students) && students.length === 0){
      const v = pickFirstArray(fallbacks.students);
      if(v){ students = v; changed = true; }
    }
    if(Array.isArray(teachers) && teachers.length === 0){
      const v = pickFirstArray(fallbacks.teachers);
      if(v){ teachers = v; changed = true; }
    }
    if(Array.isArray(reinforcers) && reinforcers.length === 0){
      const v = pickFirstArray(fallbacks.reinforcers);
      if(v){ reinforcers = v; changed = true; }
    }
    if(Array.isArray(sessions) && sessions.length === 0){
      const v = pickFirstArray(fallbacks.sessions);
      if(v){ sessions = v; changed = true; }
    }

    if(changed){
      // normalize to string arrays (defensive)
      tasks = (tasks||[]).map(x=>String(x)).filter(x=>x.trim().length>0);
      targets = (targets||[]).map(x=>String(x)).filter(x=>x.trim().length>0);
      students = (students||[]).map(x=>String(x)).filter(x=>x.trim().length>0);
      teachers = (teachers||[]).map(x=>String(x)).filter(x=>x.trim().length>0);
      reinforcers = (reinforcers||[]).map(x=>String(x)).filter(x=>x.trim().length>0);

      saveAll(); // promote to current keys
    }
  }
catch(_){ return fallback; }
  }
  function safeSet(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      alert("保存できません（容量不足/プライベートモード等の可能性）");
      return false;
    }
  }

  function loadAll(){
    sessions    = safeGet(STORAGE_KEY_SESSIONS, []);
    students    = safeGet(STORAGE_KEY_STUDENTS, []);
    teachers    = safeGet(STORAGE_KEY_TEACHERS, []);
    tasks       = safeGet(STORAGE_KEY_TASKS, []);
    targets     = safeGet(STORAGE_KEY_TARGETS, []);
    reinforcers = safeGet(STORAGE_KEY_REINFORCERS, []);
    appSettings = safeGet(STORAGE_KEY_APP_SETTINGS, { facilityName:"", showArchived:false });
    archiveStore = safeGet(STORAGE_KEY_ARCHIVE, { students:[], teachers:[], tasks:[], targets:[], reinforcers:[] });
    targetSdMap  = safeGet(STORAGE_KEY_TARGET_SD, {});
    taskTargetsMap = safeGet(STORAGE_KEY_TASK_TARGETS, {});
    if(!taskTargetsMap || typeof taskTargetsMap !== 'object' || Array.isArray(taskTargetsMap)) taskTargetsMap = {};
    if(!targetSdMap || typeof targetSdMap !== 'object' || Array.isArray(targetSdMap)) targetSdMap = {};
    if(!Array.isArray(sessions)) sessions = [];
    if(!Array.isArray(students)) students = [];
    if(!Array.isArray(teachers)) teachers = [];
    if(!Array.isArray(tasks)) tasks = [];
    // migrate from older keys if needed
    migrateLegacyData();
    if(!Array.isArray(targets)) targets = [];
    if(!Array.isArray(reinforcers)) reinforcers = [];
  }
  function saveAll(){
    return (
      safeSet(STORAGE_KEY_SESSIONS, sessions) &&
      safeSet(STORAGE_KEY_STUDENTS, students) &&
      safeSet(STORAGE_KEY_TEACHERS, teachers) &&
      safeSet(STORAGE_KEY_TASKS, tasks) &&
      safeSet(STORAGE_KEY_TARGETS, targets) &&
      safeSet(STORAGE_KEY_REINFORCERS, reinforcers) &&
      safeSet(STORAGE_KEY_TARGET_SD, targetSdMap) &&
      safeSet(STORAGE_KEY_TASK_TARGETS, taskTargetsMap)
    );
  }

  
  function renameInArray(arr, oldV, newV){
    const i = arr.indexOf(oldV);
    if(i === -1) return false;
    if(arr.includes(newV)) return false;
    arr[i] = newV;
    return true;
  }

  function confirmDanger(msg){
    return confirm(msg);
  }

  function sanitizeName(s){
    return String(s||"").trim().replace(/\s+/g, " ");
  }

  function isArchived(kind, name){
    const arr = archiveStore?.[kind] || [];
    return arr.includes(name);
  }
  function archiveAdd(kind, name){
    archiveStore[kind] = Array.from(new Set([...(archiveStore[kind]||[]), name]));
  }
  function archiveRemove(kind, name){
    archiveStore[kind] = (archiveStore[kind]||[]).filter(x=>x!==name);
  }


  function showErrors(list){
    const box = document.getElementById("sessionErrors");
    if(!box) return;
    if(!list || !list.length){
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
  
  function toast(title, sub="", type="success", ms=2200){
    const host = document.getElementById("toastHost");
    if(!host) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<div>
        <div class="t-title">${escapeHtml(title)}</div>
        ${sub ? `<div class="t-sub">${escapeHtml(sub)}</div>` : ""}
      </div>`;
    host.appendChild(el);
    requestAnimationFrame(()=> el.classList.add("show"));
    setTimeout(()=>{
      el.classList.remove("show");
      setTimeout(()=> el.remove(), 220);
    }, ms);
  }

    box.style.display = "block";
    box.innerHTML = `<ul>${list.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
  }

  function setInvalid(el, on){
    if(!el) return;
    el.classList.toggle("is-invalid", !!on);
  }

function uniqPush(arr, v){
    if(!v) return false;
    if(arr.includes(v)) return false;
    arr.push(v);
    return true;
  }

  function makeTargetTag(label, sd){
    const base = makeEditableTag(label);
    if(!sd) return base;
    // insert SD badge before closing tag span
    return base.replace('</span>', ` <span class="muted">（SD:${escapeHtml(sd)}）</span></span>`);
  }

  function makeEditableTag(label, onEdit, onDelete){
    const safe = escapeHtml(label);
    return `<span class="tag editable" data-label="${safe}">
      <span class="t">${safe}</span>
      <span class="x" role="button" title="削除" aria-label="削除">×</span>
    </span>`;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }


  function getTargetSd(targetName){
    if(!targetName) return "";
    return (targetSdMap[targetName] || "").trim();
  }
  function setTargetSd(targetName, sd){
    if(!targetName) return;
    const v = String(sd||"").trim();
    if(v) targetSdMap[targetName] = v;
    else delete targetSdMap[targetName];
  }

  function loadEditTargetSd(){
    const sel = $("editTargetSelect");
    if(!sel) return;
    const name = sel.value || "";
    const sd = getTargetSd(name);
    const input = $("editTargetSD");
    if(input) input.value = sd;
  }

  function saveEditTargetSd(){
    const sel = $("editTargetSelect");
    if(!sel) return;
    const name = sel.value || "";
    if(!name) return alert("標的行動を選択してください。");
    const sd = ($("editTargetSD")?.value || "").trim();
    setTargetSd(name, sd);
    if(!saveAll()) return;
    renderAllViews();
    updateTargetSdPreview();
    loadEditTargetSd();
    alert("指示（SD）を保存しました。※過去の記録に保存されたSDはそのままです。");
  }

  function updateTargetSdPreview(){
    const target = $("targetSelect")?.value || "";
    const targetSd = getTargetSd(target);
    const sd = getTargetSd(target);
    const text = $("targetSdText");
    if(text) text.textContent = sd ? sd : "-";
  }


  function getTargetsForTask(taskName){
    if(!taskName) return targets.slice();
    const list = taskTargetsMap[taskName];
    if(Array.isArray(list) && list.length){
      // keep only existing targets, preserve order
      const set = new Set(targets);
      return list.filter(t=>set.has(t));
    }
    // fallback: show all
    return targets.slice();
  }

  function addTargetToTask(taskName, targetName){
    if(!taskName || !targetName) return;
    if(!taskTargetsMap[taskName] || !Array.isArray(taskTargetsMap[taskName])) taskTargetsMap[taskName] = [];
    if(!taskTargetsMap[taskName].includes(targetName)) taskTargetsMap[taskName].push(targetName);
  }

  // Called by select onchange (avoid console errors)
  function onTargetTaskChange(){ /* no-op for now */ }

  
  function editStudent(oldName){
    const next = sanitizeName(prompt("生徒名を編集", oldName) || "");
    if(!next || next === oldName) return;
    if(students.includes(next)) return alert("同じ名前が既にあります。");
    if(!renameInArray(students, oldName, next)) return;
    // sessions keep text; update for display consistency
    sessions.forEach(s=>{ if(s.student === oldName) s.student = next; });
    saveAll();
    renderAll();
    validateSession();
    showErrors([]);
    validateSession();
  }

  function deleteStudent(name){
    const used = sessions.some(s=>s.student === name);
    const msg = used
      ? `「${name}」は既に記録に使用されています。\n削除すると、今後の選択肢から消えます（過去記録の文字は残ります）。\nアーカイブ（非表示）にしますか？`
      : `「${name}」をアーカイブ（非表示）にしますか？`;
    if(!confirmDanger(msg)) return;
    archiveAdd("students", name);
    students = students.filter(x=>x!==name);
    saveAll();
    renderAll();
    validateSession();
  }

  function editTeacher(oldName){
    const next = sanitizeName(prompt("講師名を編集", oldName) || "");
    if(!next || next === oldName) return;
    if(teachers.includes(next)) return alert("同じ名前が既にあります。");
    if(!renameInArray(teachers, oldName, next)) return;
    sessions.forEach(s=>{ if(s.teacher === oldName) s.teacher = next; });
    saveAll();
    renderAll();
  }

  function deleteTeacher(name){
    const used = sessions.some(s=>s.teacher === name);
    const msg = used
      ? `「${name}」は既に記録に使用されています。\n削除すると、今後の選択肢から消えます（過去記録の文字は残ります）。\nアーカイブ（非表示）にしますか？`
      : `「${name}」をアーカイブ（非表示）にしますか？`;
    if(!confirmDanger(msg)) return;
    archiveAdd("teachers", name);
    teachers = teachers.filter(x=>x!==name);
    saveAll();
    renderAll();
  }

  function editTask(oldName){
    const next = sanitizeName(prompt("課題名を編集", oldName) || "");
    if(!next || next === oldName) return;
    if(tasks.includes(next)) return alert("同じ名前が既にあります。");
    if(!renameInArray(tasks, oldName, next)) return;
    // migrate taskTargetsMap key
    if(taskTargetsMap[oldName]){
      taskTargetsMap[next] = taskTargetsMap[oldName];
      delete taskTargetsMap[oldName];
    }
    // sessions update
    sessions.forEach(s=>{ if(s.task === oldName) s.task = next; });
    saveAll();
    renderAll();
  }

  function deleteTask(name){
    const used = sessions.some(s=>s.task === name);
    const msg = used
      ? `「${name}」は既に記録に使用されています。\n削除すると、ターゲット紐づけも消え、今後の選択肢から消えます（過去記録の文字は残ります）。\nアーカイブ（非表示）にしますか？`
      : `「${name}」をアーカイブ（非表示）にしますか？（紐づくターゲットも表示されなくなります）`;
    if(!confirmDanger(msg)) return;
    archiveAdd("tasks", name);
    tasks = tasks.filter(x=>x!==name);
    delete taskTargetsMap[name];
    saveAll();
    renderAll();
  }

  function editReinforcer(oldName){
    const next = sanitizeName(prompt("強化子を編集", oldName) || "");
    if(!next || next === oldName) return;
    if(reinforcers.includes(next)) return alert("同じ名前が既にあります。");
    if(!renameInArray(reinforcers, oldName, next)) return;
    sessions.forEach(s=>{ if(s.reinforcer === oldName) s.reinforcer = next; });
    saveAll();
    renderAll();
  }

  function deleteReinforcer(name){
    const used = sessions.some(s=>s.reinforcer === name);
    const msg = used
      ? `「${name}」は既に記録に使用されています。\n削除すると、今後の選択肢から消えます（過去記録の文字は残ります）。\nアーカイブ（非表示）にしますか？`
      : `「${name}」をアーカイブ（非表示）にしますか？`;
    if(!confirmDanger(msg)) return;
    archiveAdd("reinforcers", name);
    reinforcers = reinforcers.filter(x=>x!==name);
    saveAll();
    renderAll();
  }

  function editTarget(oldName){
    const next = sanitizeName(prompt("ターゲット行動を編集", oldName) || "");
    if(!next || next === oldName) return;
    if(targets.includes(next)) return alert("同じターゲットが既にあります。");
    if(!renameInArray(targets, oldName, next)) return;

    // SD migrate
    if(targetSdMap[oldName] !== undefined){
      targetSdMap[next] = targetSdMap[oldName];
      delete targetSdMap[oldName];
    }
    // task mapping migrate
    Object.keys(taskTargetsMap||{}).forEach(t=>{
      const arr = taskTargetsMap[t];
      if(Array.isArray(arr)){
        taskTargetsMap[t] = arr.map(x=> x===oldName ? next : x);
      }
    });
    // sessions update
    sessions.forEach(s=>{ if(s.target === oldName) s.target = next; });
    saveAll();
    renderAll();
  }

  function deleteTarget(name){
    const used = sessions.some(s=>s.target === name);
    const msg = used
      ? `「${name}」は既に記録に使用されています。\n削除すると、課題との紐づけ・SDも消え、今後の選択肢から消えます（過去記録の文字は残ります）。\nアーカイブ（非表示）にしますか？`
      : `「${name}」をアーカイブ（非表示）にしますか？（課題との紐づけ・SDも削除）`;
    if(!confirmDanger(msg)) return;
    archiveAdd("targets", name);
    targets = targets.filter(x=>x!==name);
    delete targetSdMap[name];
    Object.keys(taskTargetsMap||{}).forEach(t=>{
      const arr = taskTargetsMap[t];
      if(Array.isArray(arr)){
        taskTargetsMap[t] = arr.filter(x=>x!==name);
      }
    });
    saveAll();
    renderAll();
  }

function onSessionTaskChange(){
    const task = $("taskSelect")?.value || "";
    const current = $("targetSelect")?.value || "";
    const list = getTargetsForTask(task);
    fillSelect($("targetSelect"), list, "ターゲット行動を選択");
    // restore if still available
    if(current && list.includes(current)) $("targetSelect").value = current;
    updateTargetSdPreview();
  }


  
  function bindClick(selector, handler){
    document.querySelectorAll(selector).forEach(el=>{
      el.addEventListener("click", (e)=>{ e.preventDefault(); handler(e, el); });
    });
  }

function calcStats(marks){
    const t = Array.isArray(marks) ? marks : [];
    const plus  = t.filter(x=>x==="+").length;
    const minus = t.filter(x=>x==="-").length;
    const p     = t.filter(x=>x==="P").length;
    const total = plus + minus + p;
    const rate  = total ? Math.round((plus/total)*100) : 0;
    return {plus, minus, p, total, rate};
  }

  // --- View switching (旧HTMLのonclickに合わせる) ---
  function switchView(viewId){
    document.querySelectorAll(".view").forEach(v=>{
      v.classList.toggle("view-active", v.id === viewId);
    });
    document.querySelectorAll(".menu-item").forEach(btn=>{
      const isActive = btn.getAttribute("onclick")?.includes(`'${viewId}'`) || btn.getAttribute("data-view") === viewId;
      btn.classList.toggle("active", !!isActive);
    });

    // ページタイトル（存在すれば更新）
    const map = {
      "view-home":"ホーム",
      "view-session":"DTT記録",
      "view-master":"生徒情報・設定",
      "view-logs":"記録一覧・グラフ"
    };
    const titleEl = $("currentViewTitle");
    if(titleEl) titleEl.textContent = map[viewId] || "DTT記録ツール";

    if(viewId === "view-logs"){
      // サイズ確定後に描画
      setTimeout(()=>{ renderChart(); }, 50);
    }
  }

  // --- Select fill ---
  function fillSelect(id, items, placeholder="選択してください"){
    const el = $(id);
    if(!el) return;
    const v = el.value;
    const kindById = {
      childSelect: "students",
      teacherSelect: "teachers",
      taskSelect: "tasks",
      targetSelect: "targets",
      targetTaskSelect: "tasks",
      editTargetSelect: "targets",
      reinforcer1: "reinforcers",
      reinforcer2: "reinforcers",
      reinforcer3: "reinforcers",
      reinforcer4: "reinforcers",
      reinforcer5: "reinforcers"
    };
    const kind = kindById[id];
    let list = (items || []).slice();
    if(kind && !(appSettings?.showArchived)){
      const arch = new Set(archiveStore?.[kind] || []);
      list = list.filter(x => !arch.has(x));
    }
    el.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    el.appendChild(opt0);
    list.forEach(s=>{
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      el.appendChild(opt);
    });
    // restore selection if possible
    if(v && list.includes(v)) el.value = v;
  });
    // keep selection if still exists
    if(items.includes(value)) sel.value = value;
  }

  function refreshAllSelects(){
    fillSelect($("childSelect"), students, "生徒を選択");
    fillSelect($("profileStudentSelect"), students, "生徒を選択");
    fillSelect($("teacherSelect"), teachers, "講師を選択");
    fillSelect($("taskSelect"), tasks, "課題を選択");
    fillSelect($("targetTaskSelect"), tasks, "課題を選択");
    fillSelect($("targetSelect"), targets, "ターゲット行動を選択");
    fillSelect($("editTargetSelect"), targets, "標的行動を選択");

    updateTargetSdPreview();

    // filters
    fillSelect($("graphStudentFilter"), students, "すべての生徒");
    fillSelect($("logTaskFilter"), tasks, "すべての課題");
    fillSelect($("logTargetFilter"), targets, "すべてのターゲット");

    // reinforcer ranking selects
    ["reinforcer1","reinforcer2","reinforcer3","reinforcer4","reinforcer5"].forEach(id=>{
      fillSelect($(id), reinforcers, "未指定");
    });
  }

  // --- Trial input ---
  function updateTrialUI(){
    const goal = clampInt($("trialGoal")?.value, 10, 1, 30);
    if($("trialGoal")) $("trialGoal").value = String(goal);

    const st = calcStats(currentTrials);

    // list display in original HTML
    const listEl = $("trialList");
    if(listEl){
      if(st.total === 0){
        listEl.textContent = "まだ入力はありません。";
        listEl.classList.add("trial-list-empty");
      }else{
        listEl.classList.remove("trial-list-empty");
        listEl.textContent = currentTrials.join("");
      }
    }

    if($("kpiRate")) $("kpiRate").textContent = `${st.rate}%`;
    if($("kpiDetail")) $("kpiDetail").textContent = `成功 ${st.plus} 回 / ${st.total} 回中（失敗 ${st.minus} / P ${st.p}）`;
    if($("kpiCount")) $("kpiCount").textContent = `${st.total} / ${goal}`;
    if($("kpiProgress")){
      const pct = Math.min(100, Math.round((st.total/goal)*100));
      $("kpiProgress").style.width = pct + "%";
    }
  }


  function updateBigCounters(){
    const plus = currentTrials.filter(x=>x==="+").length;
    const minus = currentTrials.filter(x=>x==="-").length;
    const p = currentTrials.filter(x=>x==="P").length;
    const total = plus + minus + p;
    const rate = (plus + minus) > 0 ? Math.round((plus / (plus + minus)) * 100) : 0;

    const elp = document.getElementById("countPlusBig");
    const elm = document.getElementById("countMinusBig");
    const elp2 = document.getElementById("countPBig");
    const elr = document.getElementById("rateBig");
    if(elp) elp.textContent = String(plus);
    if(elm) elm.textContent = String(minus);
    if(elp2) elp2.textContent = String(p);
    if(elr) elr.textContent = String(rate);
  }

  function undoTrial(){
    if(currentTrials.length === 0) return;
    currentTrials.pop();
    updateTrialUI();
    updateBigCounters();
      validateSession();
    validateSession();
    validateSession();
  }

  function resetTrial(){
    if(!confirm("試行（＋/－/P）をリセットしますか？")) return;
    currentTrials = [];
    updateTrialUI();
    updateBigCounters();
    validateSession();
    updateBigCounters();
  }



  function clampInt(v, def, min, max){
    const n = parseInt(String(v ?? ""), 10);
    if(Number.isFinite(n)){
      return Math.max(min, Math.min(max, n));
    }
    return def;
  }

  function addTrial(mark){
    currentTrials.push(mark);
    updateTrialUI();
    updateBigCounters();
  }

  // --- Master lists UI ---
  function renderArchivedSection(kind, containerId){
    if(!appSettings?.showArchived) return;
    const arr = archiveStore?.[kind] || [];
    if(!arr.length) return;
    const el = document.getElementById(containerId);
    if(!el) return;
    const wrap = document.createElement("div");
    wrap.className = "archived-wrap";
    wrap.style.marginTop = "10px";
    wrap.innerHTML = `<div class="hint-text" style="margin:6px 0 8px; font-weight:900;">アーカイブ（復元可能）</div>
      <div class="panel-list" data-archived="${kind}">
        ${arr.map(s=>`<span class="tag editable" data-arch="1"><span class="t">${escapeHtml(s)}</span><span class="x" role="button" title="復元" aria-label="復元">↩</span></span>`).join("")}
      </div>`;
    el.parentElement?.appendChild(wrap);
  }

function renderMasterLists(){
    $("studentList") && ( $("studentList").innerHTML = students.length ? students.map(s=>`${makeEditableTag(s)}`).join("") : "まだ登録がありません。" );
    renderArchivedSection("students", "studentList");
    $("teacherList") && ( $("teacherList").innerHTML = teachers.length ? teachers.map(s=>`${makeEditableTag(s)}`).join("") : "まだ登録がありません。" );
    renderArchivedSection("teachers", "teacherList");
    $("taskList") && ( $("taskList").innerHTML = tasks.length ? tasks.map(s=>`${makeEditableTag(s)}`).join("") : "まだ登録がありません。" );
    renderArchivedSection("tasks", "taskList");
    $("targetList") && ( $("targetList").innerHTML = targets.length ? targets.map(s=>`${makeEditableTag(s)}`).join("") : "まだ登録がありません。" );
    renderArchivedSection("targets", "targetList");
    $("reinforcerList") && ( $("reinforcerList").innerHTML = reinforcers.length ? reinforcers.map(s=>`${makeEditableTag(s)}`).join("") : "まだ登録がありません。" );
    renderArchivedSection("reinforcers", "reinforcerList");
  }

  function addStudent(){
    const v = sanitizeName(($("newStudentName")?.value || ""));
    if(!v) return alert("生徒名を入力してください。");
    if(!uniqPush(students, v)) return alert("既に登録済みです。");
    $("newStudentName").value = "";
    if(!saveAll()) return;
    refreshAllSelects();
    renderAllViews();
    renderProfileCards();
    updateHome();
  }
  function addTeacher(){
    const v = sanitizeName(($("newTeacherName")?.value || ""));
    if(!v) return alert("講師名を入力してください。");
    if(!uniqPush(teachers, v)) return alert("既に登録済みです。");
    $("newTeacherName").value = "";
    if(!saveAll()) return;
    refreshAllSelects();
    renderAllViews();
  }
  function addTask(){
    const v = sanitizeName(($("newTaskName")?.value || ""));
    if(!v) return alert("課題名を入力してください。");
    if(!uniqPush(tasks, v)) return alert("既に登録済みです。");
    $("newTaskName").value = "";
    if(!saveAll()) return;
    refreshAllSelects();
    renderAllViews();
  }
  function addTarget(){
    const v = sanitizeName(($("newTargetName")?.value || ""));
    const sd = sanitizeName(($("newTargetSD")?.value || ""));
    const task = ($("targetTaskSelect")?.value || "").trim();
    if(!v) return alert("ターゲット名を入力してください。");
    if(!task) return alert("課題を選択してください。");
    if(!uniqPush(targets, v)) return alert("既に登録済みです。");
    addTargetToTask(task, v);
    setTargetSd(v, sd);
    $("newTargetName").value = "";
    if($("newTargetSD")) $("newTargetSD").value = "";
    if(!saveAll()) return;
    refreshAllSelects();
    renderAllViews();
  }
  function addReinforcer(){
    const v = sanitizeName(($("newReinforcerName")?.value || ""));
    if(!v) return alert("強化子を入力してください。");
    if(!uniqPush(reinforcers, v)) return alert("既に登録済みです。");
    $("newReinforcerName").value = "";
    if(!saveAll()) return;
    refreshAllSelects();
    renderAllViews();
  }

  // --- Save session ---
  
  function validateSession(){
    const errs = [];
    const elChild = $("childSelect");
    const elTeacher = $("teacherSelect");
    const elTask = $("taskSelect");
    const elTarget = $("targetSelect");

    const child = (elChild?.value || "").trim();
    const teacher = (elTeacher?.value || "").trim();
    const task = (elTask?.value || "").trim();
    const target = (elTarget?.value || "").trim();

    if(!child) errs.push("生徒を選択してください。");
    if(!teacher) errs.push("講師を選択してください。");
    if(!task) errs.push("課題を選択してください。");

    const targetOptions = getTargetsForTask(task);
    const noTargets = task && (!targetOptions || targetOptions.length === 0);
    const hint = document.getElementById("noTargetsHint");
    if(hint) hint.style.display = noTargets ? "block" : "none";

    if(noTargets) errs.push("この課題にはターゲットが登録されていません。『生徒情報・設定』でターゲット行動を登録してください。");
    if(!target && !noTargets) errs.push("ターゲット行動を選択してください。");

    if(currentTrials.length === 0) errs.push("試行（＋/－/P）が0回です。最低1回は記録してください。");

    setInvalid(elChild, !child);
    setInvalid(elTeacher, !teacher);
    setInvalid(elTask, !task);
    setInvalid(elTarget, (!target && !noTargets) || noTargets);

    showErrors(errs);

    const btnA = document.getElementById("btnSaveSessionSticky");
    const btnB = document.getElementById("btnSaveSession");
    const disabled = errs.length > 0;
    if(btnA) btnA.disabled = disabled;
    if(btnB) btnB.disabled = disabled;

    return !disabled;
  }

function saveSession(){
    if(!validateSession()) return;
    const child = $("childSelect")?.value || "";
    const teacher = $("teacherSelect")?.value || "";
    const task = $("taskSelect")?.value || "";
    const target = $("targetSelect")?.value || "";
    const targetSd = getTargetSd(target);
    const note = ($("sessionNote")?.value || "").trim();
    const goal = clampInt($("trialGoal")?.value, 10, 1, 30);

    const reinforcerRanks = ["reinforcer1","reinforcer2","reinforcer3","reinforcer4","reinforcer5"]
      .map(id => $(id)?.value || "");

    const id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + Math.random()).toString(16));
    const datetime = new Date().toISOString();
    const st = calcStats(currentTrials);

    sessions.push({
      targetSd,
      id, datetime, child, teacher, task, target,
      marks: [...currentTrials],
      goal,
      rate: st.rate,
      note,
reinforcerRanks
    });

    $("sessionNote") && ($("sessionNote").value = "");
    currentTrials = [];
    updateTrialUI();
    updateBigCounters();

    if(!saveAll()) return;
    updateHome();
    renderLogs();
    renderChart();
    renderMiniDashboard();
    renderAnalysis();
    alert("保存しました。");
  }

  // --- Home dashboard ---
  function updateHome(){
    $("dashStudents") && ($("dashStudents").textContent = String(students.length));
    $("dashSessions") && ($("dashSessions").textContent = String(sessions.length));

    if(sessions.length === 0){
      $("dashAvgRate") && ($("dashAvgRate").textContent = "0%");
      $("dashLastSession") && ($("dashLastSession").textContent = "まだDTT記録がありません。");
      const t = $("homeStudentTable");
      if(t) t.innerHTML = "";
      return;
    }
    const avg = Math.round(sessions.reduce((a,s)=>a+(Number(s.rate)||0),0)/sessions.length);
    $("dashAvgRate") && ($("dashAvgRate").textContent = `${avg}%`);

    const sorted = sessions.slice().sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
    const last = sorted[0];
    const d = new Date(last.datetime);
    const ds = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    $("dashLastSession") && ($("dashLastSession").textContent = `${ds}　${last.child} / ${last.task} / ${last.target}（${last.rate}%）`);

    // per student latest (same table as old)
    const by = new Map();
    sessions.forEach(s=>{
      if(!by.has(s.child)) by.set(s.child, []);
      by.get(s.child).push(s);
    });

    const table = $("homeStudentTable");
    if(table){
      let html = "<thead><tr><th style='width:140px'>生徒</th><th>最新の課題・ターゲット</th><th style='width:120px'>最新成功率</th><th style='width:160px'>最終記録日時</th></tr></thead><tbody>";
      students.forEach(name=>{
        const list = (by.get(name) || []).slice().sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
        if(list.length === 0){
          html += `<tr data-student='${escapeHtml(name)}' style='cursor:pointer'><td>${escapeHtml(name)}</td><td>-</td><td class='num'>-</td><td class='center'>-</td></tr>`;
        }else{
          const s = list[0];
          const dd = new Date(s.datetime);
          const ddStr = `${dd.getMonth()+1}/${dd.getDate()} ${String(dd.getHours()).padStart(2,"0")}:${String(dd.getMinutes()).padStart(2,"0")}`;
          html += `<tr data-student='${escapeHtml(name)}' style='cursor:pointer'><td>${escapeHtml(name)}</td><td>${escapeHtml(s.task)} / ${escapeHtml(s.target)}</td><td class='num'>${s.rate}%</td><td class='center'>${ddStr}</td></tr>`;
        }
      });
      html += "</tbody>";
      table.innerHTML = html;

      table.querySelectorAll("tr[data-student]").forEach(tr=>{
        tr.addEventListener("click", ()=>{
          const name = tr.getAttribute("data-student") || "";
          const sel = document.getElementById("profileStudentSelect");
          if(sel){ sel.value = name; loadProfileToForm(); }
          switchView("view-students");
        });
      });
    }
  }

  // --- Filters ---
  function getFilteredSessions(){
    const child = $("graphStudentFilter")?.value || "";
    const task = $("logTaskFilter")?.value || "";
    const target = $("logTargetFilter")?.value || "";
    return sessions.filter(s=>{
      if(child && s.child !== child) return false;
      if(task && s.task !== task) return false;
      if(target && s.target !== target) return false;
      return true;
    });
  }

  // --- Logs list ---
  function deleteSession(id){
    const idx = sessions.findIndex(s=>s.id===id);
    if(idx < 0) return;
    if(!confirm("この記録を削除しますか？")) return;
    sessions.splice(idx, 1);
    if(!saveAll()) return;
    updateHome();
    renderLogs();
    renderChart();
    renderMiniDashboard();
    renderAnalysis();
  }

  function renderLogs(){
    const box = $("sessionList");
    if(!box) return;
    const list = getFilteredSessions().slice().sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
    if(list.length === 0){
      box.innerHTML = "<div class='note-text'>該当する記録がありません。</div>";
      return;
    }

    box.innerHTML = list.map(s=>{
      const d = new Date(s.datetime);
      const ds = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      const st = calcStats(s.marks);
      const ranks = (Array.isArray(s.reinforcerRanks)?s.reinforcerRanks:[]).filter(Boolean).slice(0,5);
      const ranksText = ranks.length ? ranks.map((r,i)=>`#${i+1} ${escapeHtml(r)}`).join(" / ") : "未指定";
      const note = s.note ? escapeHtml(s.note) : "<span class='muted'>-</span>";
      const pt = s.promptType ? escapeHtml(s.promptType) : "<span class='muted'>未指定</span>";
      return `
        <div class="log-item">
          <div class="log-top">
            <div class="log-title">${escapeHtml(s.child)}　<span class="muted">(${ds})</span></div>
            <div class="log-rate">${st.rate}%</div>
          </div>
          <div class="log-meta">
            <span class="tag">課題：${escapeHtml(s.task)}</span>
            <span class="tag">ターゲット：${escapeHtml(s.target)}</span>
            ${s.targetSd?`<span class="tag">指示（SD）：${escapeHtml(s.targetSd)}</span>`:""}
            <span class="tag">講師：${escapeHtml(s.teacher)}</span>
            <span class="tag">P：${pt}</span>
          </div>
          <div class="log-meta" style="margin-top:6px;">
            <span class="tag">強化子：${ranksText}</span>
            <span class="tag">試行：+${st.plus}/-${st.minus}/P${st.p}（${st.total}）</span>
          </div>
          <div class="log-note">${note}</div>
          <div class="log-actions">
            <button class="btn btn-outline" data-del="${escapeHtml(s.id)}">削除</button>
          </div>
        </div>
      `;
    }).join("");

    box.querySelectorAll("button[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-del");
        deleteSession(id);
      });
    });
  }

  // --- Chart (canvas) ---
  function groupByDay(listAsc){
    const map = new Map();
    listAsc.forEach(s=>{
      const d = new Date(s.datetime);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if(!map.has(key)) map.set(key, {date:key, sum:0, n:0});
      const g = map.get(key);
      g.sum += Number(s.rate||0);
      g.n += 1;
    });
    return Array.from(map.values()).sort((a,b)=>a.date.localeCompare(b.date)).map(g=>({date:g.date, rate:g.n?Math.round(g.sum/g.n):0}));
  }

  function renderChart(){
    const canvas = $("sessionChart");
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width*dpr);
    canvas.height = Math.floor(rect.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const list = getFilteredSessions().slice().sort((a,b)=> new Date(a.datetime)-new Date(b.datetime)); // oldest->newest
    const points = groupByDay(list);

    const w = rect.width, h = rect.height;
    ctx.clearRect(0,0,w,h);

    const padL=38, padR=16, padT=16, padB=26;
    const plotW = w-padL-padR;
    const plotH = h-padT-padB;

    // axes
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT+plotH);
    ctx.lineTo(padL+plotW, padT+plotH);
    ctx.stroke();

    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "#6b7280";
    for(let i=0;i<=4;i++){
      const yv = i*25;
      const y = padT+plotH - (yv/100)*plotH;
      ctx.strokeStyle = "#eef2f7";
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke();
      ctx.fillText(String(yv), 8, y+4);
    }

    if(points.length === 0){
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("データがありません（フィルタを変更してください）", padL+8, padT+20);
      return;
    }

    const toX = (i)=> padL + (points.length===1?0:(i/(points.length-1))*plotW);
    const toY = (v)=> padT+plotH - (v/100)*plotH;

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p,i)=>{
      const x = toX(i), y = toY(p.rate);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    ctx.fillStyle = "#2563eb";
    points.forEach((p,i)=>{
      const x=toX(i), y=toY(p.rate);
      ctx.beginPath(); ctx.arc(x,y,3.4,0,Math.PI*2); ctx.fill();
    });

    // x labels
    const step = Math.max(1, Math.floor(points.length/6));
    ctx.fillStyle="#6b7280";
    for(let i=0;i<points.length;i+=step){
      const x=toX(i);
      const label = points[i].date.slice(5); // MM-DD
      ctx.save();
      ctx.translate(x, padT+plotH+18);
      ctx.rotate(-0.35);
      ctx.fillText(label, -10, 0);
      ctx.restore();
    }
  }

  // --- Mini dashboard (旧HTMLのIDsに合わせる) ---
  function renderMiniDashboard(){
    const child = $("graphStudentFilter")?.value || "";
    const summaryEl = $("studentMiniSummary");
    const tableEl = $("studentMiniTable");
    if(!summaryEl || !tableEl) return;

    if(!child){
      summaryEl.textContent = "生徒フィルタで1名を選択すると、ここに概要が表示されます。";
      tableEl.innerHTML = "";
      return;
    }

    const list = sessions.filter(s=>s.child===child).slice().sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
    if(list.length === 0){
      summaryEl.textContent = "この生徒の記録がありません。";
      tableEl.innerHTML = "";
      return;
    }

    const allMarks = list.flatMap(s=>s.marks||[]);
    const st = calcStats(allMarks);
    const pr = st.total ? Math.round((st.p/st.total)*100) : 0;
    summaryEl.innerHTML = `成功率 <b>${st.rate}%</b> ／ P率 <b>${pr}%</b> ／ 記録 <b>${list.length}</b> 件`;

    // group by task/target
    const map = new Map(); // key=task|target
    list.forEach(s=>{
      const key = `${s.task}|||${s.target}`;
      if(!map.has(key)) map.set(key, {task:s.task, target:s.target, sum:0, n:0});
      const g = map.get(key);
      g.sum += Number(s.rate||0);
      g.n += 1;
    });
    const rows = Array.from(map.values()).sort((a,b)=> (b.n-b.n) || (b.sum/b.n)-(a.sum/a.n));

    let html = "<thead><tr><th>課題</th><th>ターゲット</th><th style='width:110px'>平均成功率</th><th style='width:90px'>件数</th></tr></thead><tbody>";
    rows.forEach(r=>{
      const avg = r.n ? Math.round(r.sum/r.n) : 0;
      html += `<tr><td>${escapeHtml(r.task)}</td><td>${escapeHtml(r.target)}</td><td>${avg}%</td><td>${r.n}</td></tr>`;
    });
    html += "</tbody>";
    tableEl.innerHTML = html;
  }

  // --- Analysis table (旧HTMLのIDsに合わせる) ---
  function renderAnalysis(){
    const summaryEl = $("analysisSummary");
    const tableEl = $("analysisTable");
    if(!summaryEl || !tableEl) return;

    const list = getFilteredSessions().slice().sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
    if(list.length === 0){
      summaryEl.textContent = "まだデータがありません。";
      tableEl.innerHTML = "";
      return;
    }

    const pos = new Map(); // trial index -> count of '-'
    list.forEach(s=>{
      (s.marks||[]).forEach((m,i)=>{
        if(m === "-"){
          const k = i+1;
          pos.set(k, (pos.get(k)||0)+1);
        }
      });
    });

    const entries = Array.from(pos.entries()).sort((a,b)=> b[1]-a[1]);
    if(entries.length === 0){
      summaryEl.textContent = "ミス（－）がありません。";
      tableEl.innerHTML = "";
      return;
    }

    const top = entries[0];
    summaryEl.innerHTML = `最も多いのは <b>${top[0]}回目</b>（<b>${top[1]}</b> 回）です。`;

    let html = "<thead><tr><th style='width:120px'>何回目</th><th>ミス（－）回数</th></tr></thead><tbody>";
    entries.slice(0, 20).forEach(([k,c])=>{
      html += `<tr><td>${k}回目</td><td>${c}</td></tr>`;
    });
    html += "</tbody>";
    tableEl.innerHTML = html;
  }

  // --- Backup / restore ---
  function exportBackup(){
    const payload = {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      sessions, students, teachers, tasks, targets, reinforcers
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aba_backup.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function importBackup(event){
    const file = event?.target?.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const data = JSON.parse(String(reader.result||"{}"));
        sessions = Array.isArray(data.sessions) ? data.sessions : [];
        students = Array.isArray(data.students) ? data.students : [];
        teachers = Array.isArray(data.teachers) ? data.teachers : [];
        tasks = Array.isArray(data.tasks) ? data.tasks : [];
        targets = Array.isArray(data.targets) ? data.targets : [];
        reinforcers = Array.isArray(data.reinforcers) ? data.reinforcers : [];
        if(!saveAll()) return;
        refreshAllSelects();
        renderAllViews();
        updateHome();
        renderLogs();
        renderChart();
        renderMiniDashboard();
        renderAnalysis();
        alert("バックアップを復元しました。");
      }catch(e){
        alert("復元に失敗しました（ファイル形式を確認してください）。");
      }finally{
        try{ event.target.value = ""; }catch(_){}
      }
    };
    reader.readAsText(file, "utf-8");
  }

  // --- CSV / PDF / Print chart ---
  function exportCsv(){
    const head = ["日時","生徒","講師","課題","ターゲット","指示（SD）","+数","-数","P数","合計","成功率","強化子(1-5)","メモ","試行列"];
    const rows = [head];
    sessions.slice().sort((a,b)=> new Date(a.datetime)-new Date(b.datetime)).forEach(s=>{
      const st = calcStats(s.marks);
      const ranks = (s.reinforcerRanks||[]).map(x=>x||"").join(" | ");
      rows.push([
        s.datetime||"", s.child||"", s.teacher||"", s.task||"", s.target||"", (s.targetSd||""),
        String(st.plus), String(st.minus), String(st.p), String(st.total), String(st.rate),
        ranks, (s.note||""), (s.marks||[]).join("")
      ]);
    });
    const csv = rows.map(r=> r.map(v=> `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aba_sessions.csv";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function openPdfReport(){
    const list = getFilteredSessions().slice().sort((a,b)=> new Date(a.datetime)-new Date(b.datetime));
    const rows = list.map(s=>{
      const d=new Date(s.datetime);
      const ds=`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      const st = calcStats(s.marks);
      const ranks = (s.reinforcerRanks||[]).filter(Boolean).slice(0,5).join(" / ") || "-";
      return `<tr>
        <td>${escapeHtml(ds)}</td><td>${escapeHtml(s.child||"")}</td><td>${escapeHtml(s.teacher||"")}</td>
        <td>${escapeHtml(s.task||"")}</td><td>${escapeHtml(s.target||"")}</td><td>${escapeHtml(s.targetSd||"")}</td>
        <td>+${st.plus}/-${st.minus}/P${st.p}（${st.total}）</td>
        <td>${st.rate}%</td><td>${escapeHtml(ranks)}</td>
        <td>${escapeHtml(s.note||"")}</td>
      </tr>`;
    }).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ABAレポート</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto;padding:16px;}
      h1{font-size:16px;margin:0 0 12px 0}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
      th,td{border:1px solid #e5e7eb;padding:6px;vertical-align:top;word-break:break-word}
      th{background:#f8fafc}
    </style></head><body>
    <h1>DTT記録レポート（フィルタ適用）</h1>
    <table>
      <thead><tr>
        <th style="width:140px">日時</th><th style="width:110px">生徒</th><th style="width:110px">講師</th>
        <th style="width:120px">課題</th><th style="width:160px">ターゲット</th><th style="width:140px">指示（SD）</th>
        <th style="width:160px">試行</th><th style="width:70px">成功率</th>
        <th style="width:180px">強化子</th><th>メモ</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

    const win = window.open("", "_blank");
    if(!win){ alert("ポップアップがブロックされました。"); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }

  function printChart(){
    const canvas = $("sessionChart");
    if(!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if(!win){ alert("ポップアップがブロックされました。"); return; }
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>グラフ印刷</title></head>
    <body style="margin:0;padding:16px;font-family:system-ui"><h1 style="font-size:16px;margin:0 0 10px 0;">成功率の推移</h1>
    <img src="${dataUrl}" style="width:100%;max-width:960px">
    <script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  }


// --- 生徒リスト（追加） ---
const STORAGE_KEY_STUDENT_PROFILES = "ABA_SCHPASS_STUDENT_PROFILES_V1";
  const STORAGE_KEY_APP_SETTINGS = "ABA_SCHPASS_APP_SETTINGS_V1";
  const STORAGE_KEY_ARCHIVE = "ABA_SCHPASS_ARCHIVE_V1";
let studentProfiles = {}; // { [name]: { grade, tags, note, updatedAt } }

function loadProfiles(){
  studentProfiles = safeGet(STORAGE_KEY_STUDENT_PROFILES, {});
  if(!studentProfiles || typeof studentProfiles !== "object" || Array.isArray(studentProfiles)) studentProfiles = {};
}
function saveProfiles(){
  return safeSet(STORAGE_KEY_STUDENT_PROFILES, studentProfiles);
}
function getProfile(name){
  if(!name) return null;
  return studentProfiles[name] || null;
}
function setProfile(name, data){
  if(!name) return false;
  studentProfiles[name] = {
    grade: (data.grade||"").trim(),
    tags: (data.tags||"").trim(),
    note: (data.note||"").trim(),
    updatedAt: new Date().toISOString()
  };
  return true;
}

function renderProfileCards(){
  const wrap = document.getElementById("profileCardList");
  if(!wrap) return;
  if(students.length === 0){
    wrap.innerHTML = "<div class='note-text'>まだ生徒が登録されていません。</div>";
    return;
  }
  wrap.innerHTML = students.map(name=>{
    const p = getProfile(name) || {};
    const grade = p.grade ? escapeHtml(p.grade) : "未設定";
    const tags = p.tags ? escapeHtml(p.tags) : "";
    const note = p.note ? (escapeHtml(p.note).slice(0,80) + (p.note.length>80?"…":"")) : "メモなし";
    return `
      <div class="profile-card" data-student="${escapeHtml(name)}">
        <div class="name">${escapeHtml(name)}</div>
        <div class="meta">学年：${grade}${tags?` / タグ：${tags}`:""}</div>
        <div class="note">${note}</div>
      </div>
    `;
  }).join("");
  wrap.querySelectorAll(".profile-card").forEach(el=>{
    el.addEventListener("click", ()=>{
      const name = el.getAttribute("data-student") || "";
      const sel = document.getElementById("profileStudentSelect");
      if(sel){
        sel.value = name;
        loadProfileToForm();
      }
      switchView("view-students");
    });
  });
}

function updateProfileSummary(name){
  const el = document.getElementById("profileSummary");
  if(!el) return;
  if(!name){ el.textContent = "生徒を選択すると表示されます。"; return; }
  const p = getProfile(name);
  if(!p){
    el.textContent = "この生徒の台帳情報はまだありません（右上の入力欄で保存できます）。";
    return;
  }
  const u = p.updatedAt ? new Date(p.updatedAt) : null;
  const ds = u ? `${u.getFullYear()}/${u.getMonth()+1}/${u.getDate()} ${String(u.getHours()).padStart(2,"0")}:${String(u.getMinutes()).padStart(2,"0")}` : "-";
  el.innerHTML = `更新：<b>${ds}</b> / 学年：<b>${escapeHtml(p.grade||"未設定")}</b> / タグ：<b>${escapeHtml(p.tags||"")}</b>`;
}

function loadProfileToForm(){
  const sel = document.getElementById("profileStudentSelect");
  const name = sel ? (sel.value||"") : "";
  const p = getProfile(name) || {};
  const grade = document.getElementById("profileGrade");
  const tags = document.getElementById("profileTags");
  const note = document.getElementById("profileNote");
  if(grade) grade.value = p.grade || "";
  if(tags) tags.value = p.tags || "";
  if(note) note.value = p.note || "";
  updateProfileSummary(name);
}

function clearProfileForm(){
  const grade = document.getElementById("profileGrade");
  const tags = document.getElementById("profileTags");
  const note = document.getElementById("profileNote");
  if(grade) grade.value = "";
  if(tags) tags.value = "";
  if(note) note.value = "";
}
function saveProfileFromForm(){
  const sel = document.getElementById("profileStudentSelect");
  const name = sel ? (sel.value||"") : "";
  if(!name) return alert("生徒を選択してください。");
  const grade = document.getElementById("profileGrade")?.value || "";
  const tags = document.getElementById("profileTags")?.value || "";
  const note = document.getElementById("profileNote")?.value || "";
  setProfile(name, {grade, tags, note});
  if(!saveProfiles()) return;
  renderProfileCards();
  updateProfileSummary(name);
  alert("生徒リストを保存しました。");
}


  // Expose functions (旧HTMLのonclick用)
  window.switchView = switchView;
  window.addTrial = addTrial;
  window.saveSession = saveSession;
  window.addStudent = addStudent;
  window.addTeacher = addTeacher;
  window.addTask = addTask;
  window.addTarget = addTarget;
  window.addReinforcer = addReinforcer;
  window.exportBackup = exportBackup;
  window.importBackup = importBackup;
  window.exportCsv = exportCsv;
  window.openPdfReport = openPdfReport;
  window.printChart = printChart;

  // Init
  document.addEventListener("DOMContentLoaded", ()=>{

    // Master registration buttons (v16 fix)
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener("click", (e)=>{ e.preventDefault(); fn(); });
    };
    bind("btnAddStudent", addStudent);
    bind("btnAddTeacher", addTeacher);
    bind("btnAddTask", addTask);
    bind("btnAddReinforcer", addReinforcer);
    bind("btnAddTarget", addTarget);

    // Enter key submits (inputs)
    const bindEnter = (inputId, fn) => {
      const el = document.getElementById(inputId);
      if(!el) return;
      el.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          e.preventDefault();
          fn();
        }
      });
    };
    bindEnter("newStudentName", addStudent);
    bindEnter("newTeacherName", addTeacher);
    bindEnter("newTaskName", addTask);
    bindEnter("newReinforcerName", addReinforcer);
    bindEnter("newTargetName", addTarget);
    bindEnter("newTargetSD", addTarget);


    // --- Bind UI events even if inline onclick is blocked ---
    // Profile
    document.getElementById('profileStudentSelect')?.addEventListener('change', loadProfileToForm);
    document.getElementById('btnSaveProfile')?.addEventListener('click', (e)=>{e.preventDefault(); saveProfileFromForm();});
    document.getElementById('btnClearProfile')?.addEventListener('click', (e)=>{e.preventDefault(); clearProfileForm();});

    // Menu
    bindClick(".menu-item[data-view]", (_e, el)=> switchView(el.getAttribute("data-view")));
    // Trial buttons
bindClick('button[onclick^="addTrial(\'-\')"]', ()=> addTrial("-"));
bindClick('button[onclick^="saveSession()"]', ()=> saveSession());

    // Master add buttons
    bindClick('button[onclick^="addStudent()"]', ()=> addStudent());
    bindClick('button[onclick^="addTeacher()"]', ()=> addTeacher());
    bindClick('button[onclick^="addTask()"]', ()=> addTask());
    bindClick('button[onclick^="addTarget()"]', ()=> addTarget());
    bindClick('button[onclick^="addReinforcer()"]', ()=> addReinforcer());

    // Logs
    bindClick('button[onclick^="exportBackup()"]', ()=> exportBackup());
    bindClick('button[onclick^="exportCsv()"]', ()=> exportCsv());
    bindClick('button[onclick^="openPdfReport()"]', ()=> openPdfReport());
    bindClick('button[onclick^="printChart()"]', ()=> printChart());

    loadAll();
    applyAppSettings();
    loadProfiles();
    refreshAllSelects();
    renderAllViews();
    renderProfileCards();
    updateHome();
    renderLogs();
    renderChart();
    renderMiniDashboard();
    renderAnalysis();
    updateTrialUI();

    // filters reactive (even if onchange exists, this is safer)
    ["graphStudentFilter","logTaskFilter","logTargetFilter"].forEach(id=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("change", ()=>{
        renderLogs();
        renderChart();
        renderMiniDashboard();
        renderAnalysis();
      });
    });

    // trial goal changes update kpi
    $("trialGoal")?.addEventListener("change", updateTrialUI);

    // Trials (no inline onclick to avoid double-count)
    document.getElementById("btnTrialPlus")?.addEventListener("click", (e)=>{ e.preventDefault(); addTrial("+"); });
    document.getElementById("btnTrialMinus")?.addEventListener("click", (e)=>{ e.preventDefault(); addTrial("-"); });
    document.getElementById("btnTrialP")?.addEventListener("click", (e)=>{ e.preventDefault(); addTrial("P"); });
    document.getElementById("btnUndoTrial")?.addEventListener("click", (e)=>{ e.preventDefault(); undoTrial(); });
    document.getElementById("btnResetTrial")?.addEventListener("click", (e)=>{ e.preventDefault(); resetTrial(); });
    document.getElementById("btnSaveSessionSticky")?.addEventListener("click", (e)=>{ e.preventDefault(); saveSession(); });

    $("targetSelect")?.addEventListener("change", (e)=>{ updateTargetSdPreview(); validateSession(); });
    $("taskSelect")?.addEventListener("change", (e)=>{ onSessionTaskChange(); validateSession(); });
    $("targetTaskSelect")?.addEventListener("change", onTargetTaskChange);
    $("editTargetSelect")?.addEventListener("change", loadEditTargetSd);
    document.getElementById("btnSaveTargetSD")?.addEventListener("click", (e)=>{e.preventDefault(); saveEditTargetSd();});
  });
})();


// --- PWA: Service Worker & Install prompt ---
(function(){
  if(!("serviceWorker" in navigator)) return;
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./sw.js").catch(()=>{ /* ignore */ });
  });

  let deferredPrompt = null;
  const btn = document.getElementById("btnInstallPwa");
  const hint = document.getElementById("installHint");

  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    if(hint) hint.style.display = "block";
    if(btn) btn.style.display = "inline-flex";
  });

  if(btn){
    btn.addEventListener("click", async ()=>{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(()=>{});
      deferredPrompt = null;
      btn.style.display = "none";
    });
  }
})();


// --- PWA update helper (v2) ---
(function(){
  if(!("serviceWorker" in navigator)) return;
  // When SW updated, ask it to activate immediately
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    // reload once to use latest assets
    if(window.__reloadedForSw) return;
    window.__reloadedForSw = true;
    window.location.reload();
  });

  navigator.serviceWorker.getRegistration("./").then((reg)=>{
    if(!reg) return;
    reg.addEventListener("updatefound", ()=>{
      const newWorker = reg.installing;
      if(!newWorker) return;
      newWorker.addEventListener("statechange", ()=>{
        if(newWorker.state === "installed" && navigator.serviceWorker.controller){
          newWorker.postMessage({type:"SKIP_WAITING"});
        }
      });
    });
  }).catch(()=>{});
})();


  function applyAppSettings(){
    const badge = document.getElementById("facilityBadge");
    const name = (appSettings?.facilityName || "").trim();
    if(badge){
      if(name){
        badge.style.display = "inline-flex";
        badge.textContent = `🏢 ${name}`;
      }else{
        badge.style.display = "none";
        badge.textContent = "";
      }
    }
    const input = document.getElementById("facilityNameInput");
    if(input && input.value !== name) input.value = name;
    const tgl = document.getElementById("toggleShowArchived");
    if(tgl) tgl.checked = !!appSettings?.showArchived;
  }

  function renderAllViews(){
    // existing functions
    try{ refreshAllSelects(); }catch(e){}
    try{ renderAllViews(); }catch(e){}
    try{ renderLogs(); }catch(e){}
    try{ renderStudents(); }catch(e){}
    try{ applyAppSettings(); }catch(e){}
  }


  function exportCSV(){
    if(!sessions || sessions.length===0){
      toast("エクスポートできる記録がありません", "", "warn");
      return;
    }
    // Flatten session object to CSV
    const cols = ["date","time","student","teacher","task","target","sd","plus","minus","prompt","successRate","reinforcer","note"];
    const rows = sessions.map(s=>{
      const p = (s.trials||[]).filter(x=>x==="+" ).length;
      const m = (s.trials||[]).filter(x=>x==="-" ).length;
      const pr = (s.trials||[]).filter(x=>x==="P").length;
      const total = p+m+pr;
      const rate = total ? Math.round((p/total)*1000)/10 : 0;
      return {
        date: s.date || "",
        time: s.time || "",
        student: s.student || s.child || "",
        teacher: s.teacher || "",
        task: s.task || "",
        target: s.target || "",
        sd: s.targetSd || s.sd || "",
        plus: p,
        minus: m,
        prompt: pr,
        successRate: rate,
        reinforcer: s.reinforcer || "",
        note: (s.note || s.sessionNote || "").replace(/\n/g," ")
      };
    });
    const esc = (v)=>{
      const s = String(v ?? "");
      if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const head = cols.join(",");
    const body = rows.map(r=> cols.map(c=>esc(r[c])).join(",")).join("\n");
    const csv = head + "\n" + body;
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,10);
    a.href = URL.createObjectURL(blob);
    a.download = `aba_dtt_sessions_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("CSVを出力しました", "記録一覧のエクスポート", "success");
  }
