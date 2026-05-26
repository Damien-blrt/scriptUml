// ========================================
//  Gantt → PlantUML  —  Application Logic
// ========================================

// --- Set today as default date ---
(function initDefaults() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('projectStart').value = today;
})();

// --- Example data ---
function loadExample() {
  document.getElementById('csvInput').value = `DUREE(DAYS),PREDECESSEURS,NOM_TACHE,REALISE_OUI_OU_NON_OU_POURCENTAGE,QUI
4,-,Spécifications fonctionnelles,100,DamienChef
5,Spécifications fonctionnelles,Conception Architecture,100,DamienArchitecte
3,Conception Architecture,Modélisation Base de Données,100,DamienArchitecte/LeadDamien
8,Modélisation Base de Données,Développement Backend API,50,LeadDamien/DamienDev
6,Modélisation Base de Données,Intégration Maquettes UI,75,FrontendDamien
5,Développement Backend API;Intégration Maquettes UI,Connexion API Backend-Frontend,0,LeadDamien/FrontendDamien
4,Connexion API Backend-Frontend,Tests unitaires et intégration,0,QA_Damien
3,Tests unitaires et intégration,Configuration CI-CD,0,DevopsDamien
2,Configuration CI-CD,Déploiement en Production,0,DevopsDamien/DamienChef`;
}

function clearInput() {
  document.getElementById('csvInput').value = '';
  document.getElementById('outputCode').style.display = 'none';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('statsBar').style.display = 'none';
  document.getElementById('lineCount').textContent = '— lignes';
  document.getElementById('btnCopyOutput').style.display = 'none';
}

// --- HTML escaping ---
function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Core generator (mirrors the bash script logic) ---
function generate() {
  const raw = document.getElementById('csvInput').value.trim();
  if (!raw) return;

  const title = document.getElementById('projectTitle').value || 'Diagramme de Gantt du Projet';
  const startDate = document.getElementById('projectStart').value || new Date().toISOString().split('T')[0];
  const closeSat = document.getElementById('closeSat').checked;
  const closeSun = document.getElementById('closeSun').checked;

  const lines = raw.split('\n');
  const output = [];
  let taskCount = 0, depCount = 0, doneCount = 0, wipCount = 0;

  output.push('@startgantt');
  output.push(`Title ${title}`);
  output.push(`Project starts ${startDate}`);
  if (closeSat) output.push('saturday are closed');
  if (closeSun) output.push('sunday are closed');
  output.push('--- Tâches ---');
  output.push('');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 3) continue;

    let duree = (parts[0] || '').trim();
    let preds = (parts[1] || '').trim();
    let nom   = (parts[2] || '').trim();
    let realise = (parts[3] || '').trim();
    let qui   = (parts[4] || '').trim();

    if (!nom) continue;
    taskCount++;

    // Resources
    let resourceText = '';
    if (qui) {
      const resources = qui.replace(/\r/g, '').split(/[/\s]+/).filter(Boolean);
      if (resources.length > 0) {
        resourceText = 'on ' + resources.map(r => `{${r}}`).join(' ');
      }
    }

    // Duration
    let days = parseFloat(duree);
    if (isNaN(days) || days <= 0) days = 8;
    const daysStr = Number.isInteger(days) ? String(days) : String(parseFloat(days.toFixed(3)));

    // Task declaration
    const taskDecl = `[${nom}]${resourceText ? ' ' + resourceText : ''} requires ${daysStr} days`;
    output.push(taskDecl);

    // Completion
    const r = realise.toLowerCase();
    let color = '#FFA0A0';
    if (/^(oui|yes|true)$/.test(r)) {
      color = '#A0FFA0';
      output.push(`[${nom}] is 100% completed`);
      doneCount++;
    } else if (/^\d+$/.test(r)) {
      const pct = parseInt(r, 10);
      if (pct >= 0 && pct <= 100) {
        if (pct === 100) {
          color = '#A0FFA0';
          output.push(`[${nom}] is 100% completed`);
          doneCount++;
        } else {
          color = '#FFCC66';
          output.push(`[${nom}] is ${pct}% completed`);
          if (pct > 0) wipCount++;
        }
      }
    }

    output.push(`[${nom}] is colored in ${color}`);

    // Dependencies
    if (preds && preds !== '-') {
      const predList = preds.split(';').map(p => p.trim()).filter(Boolean);
      for (const pred of predList) {
        output.push(`[${pred}] -> [${nom}]`);
        depCount++;
      }
    }

    output.push('');
  }

  output.push('@endgantt');

  const result = output.join('\n');

  // Syntax highlighting
  const highlighted = result
    .split('\n')
    .map(line => {
      if (line.startsWith('@start') || line.startsWith('@end')) {
        return `<span class="line-tag">${esc(line)}</span>`;
      }
      if (line.startsWith('Title') || line.startsWith('Project') || line.startsWith('saturday') || line.startsWith('sunday')) {
        return `<span class="line-directive">${esc(line)}</span>`;
      }
      if (line.startsWith('---')) {
        return `<span class="line-section">${esc(line)}</span>`;
      }
      if (line.match(/^\[.*\] requires/)) {
        return line.replace(/(\[.*?\])/g, '<span class="line-task">$1</span>')
                   .replace(/(\d+) days/, '<span class="line-state">$1</span> days');
      }
      if (line.match(/is \d+% completed/) || line.match(/is colored/)) {
        return `<span class="line-state">${esc(line)}</span>`;
      }
      if (line.match(/->/)) {
        return `<span class="line-dep">${esc(line)}</span>`;
      }
      return esc(line);
    })
    .join('\n');

  // Show output
  document.getElementById('emptyState').style.display = 'none';
  const codeEl = document.getElementById('outputCode');
  codeEl.style.display = 'block';
  codeEl.innerHTML = highlighted;
  document.getElementById('lineCount').textContent = `${output.length} lignes`;
  document.getElementById('btnCopyOutput').style.display = 'inline-flex';

  // Stats
  document.getElementById('statTasks').textContent = taskCount;
  document.getElementById('statDeps').textContent = depCount;
  document.getElementById('statDone').textContent = doneCount;
  document.getElementById('statWip').textContent = wipCount;
  document.getElementById('statsBar').style.display = 'flex';

  // Store plain text for copy/download
  codeEl.dataset.plain = result;
}

// --- Get plain output ---
function getPlainOutput() {
  const el = document.getElementById('outputCode');
  return el.dataset.plain || '';
}

// --- Copy to clipboard ---
function copyOutput() {
  const text = getPlainOutput();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => showToast('Copié dans le presse-papiers'));
}

// --- Download .puml file ---
function downloadOutput() {
  const text = getPlainOutput();
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gantt.puml';
  a.click();
  showToast('Fichier téléchargé');
}

// --- Toast notification ---
function showToast(msg) {
  const t = document.getElementById('toast');
  t.querySelector('.toast-text').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// --- Keyboard shortcut: Ctrl+Enter to generate ---
document.getElementById('csvInput').addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') generate();
});
