import { supabase } from './supabase.js';

/* ── STATE ────────────────────────────────────── */
let catalogItems = [];
let designRules = [];

/* ── INIT ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initCatalog();
    initRules();
    initAnalytics();
});

/* ── CATALOG ──────────────────────────────────── */
async function initCatalog() {
    await loadCatalog();

    const form = document.getElementById('form-catalog');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const item = {
            name: formData.get('name'),
            category: formData.get('category'),
            width: parseInt(formData.get('width')),
            height: parseInt(formData.get('height')),
            depth: parseInt(formData.get('depth')),
            price: parseFloat(formData.get('price')),
        };
        const id = formData.get('id');
        if (id) item.id = id;

        const { error } = await supabase.from('catalog_items').upsert(item);
        if (error) {
            alert('Error saving item: ' + error.message);
        } else {
            form.reset();
            form.querySelector('[name="id"]').value = '';
            loadCatalog();
        }
    });
}

async function loadCatalog() {
    const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading catalog:', error);
        return;
    }

    catalogItems = data;
    renderCatalogTable();
}

function renderCatalogTable() {
    const tbody = document.getElementById('catalog-list');
    tbody.innerHTML = '';

    catalogItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color:white;">${item.name}</strong></td>
            <td>${getCategoryLabel(item.category)}</td>
            <td>${item.width} x ${item.height} x ${item.depth}</td>
            <td style="color:var(--accent);">€${item.price}</td>
            <td>
                <button onclick="window.editItem('${item.id}')">Editar</button>
                <button class="danger" onclick="window.deleteItem('${item.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getCategoryLabel(cat) {
    const map = { base: 'Bajo', wall: 'Alto', tall: 'Columna' };
    return map[cat] || cat;
}

window.editItem = (id) => {
    const item = catalogItems.find(i => i.id === id);
    if (!item) return;

    const form = document.getElementById('form-catalog');
    form.querySelector('[name="id"]').value = item.id;
    form.querySelector('[name="name"]').value = item.name;
    form.querySelector('[name="category"]').value = item.category;
    form.querySelector('[name="width"]').value = item.width;
    form.querySelector('[name="height"]').value = item.height;
    form.querySelector('[name="depth"]').value = item.depth;
    form.querySelector('[name="price"]').value = item.price;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteItem = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este mueble?')) return;
    const { error } = await supabase.from('catalog_items').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadCatalog();
};

/* ── RULES ────────────────────────────────────── */
async function initRules() {
    await loadRules();
}

async function loadRules() {
    const { data, error } = await supabase
        .from('design_rules')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading rules:', error);
        return;
    }

    designRules = data;
    renderRulesTable();
}

function renderRulesTable() {
    const tbody = document.getElementById('rules-list');
    tbody.innerHTML = '';

    designRules.forEach(rule => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color:white;">${rule.rule_name}</strong></td>
            <td><input type="number" value="${rule.value}" onchange="updateRule('${rule.id}', 'value', this.value)" style="width:80px;"></td>
            <td>${rule.unit}</td>
             <td>
                <button class="danger" onclick="window.deleteRule('${rule.id}')">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.addRule = async () => {
    const name = prompt('Nombre de la regla (ej: MinPassageWidth):');
    if (!name) return;

    const { error } = await supabase.from('design_rules').insert({
        rule_name: name,
        value: 0,
        unit: 'mm'
    });

    if (error) alert('Error: ' + error.message);
    else loadRules();
};

window.updateRule = async (id, field, value) => {
    const { error } = await supabase.from('design_rules').update({ [field]: value }).eq('id', id);
    if (error) alert('Error: ' + error.message);
}

window.deleteRule = async (id) => {
    if (!confirm('Borrar regla?')) return;
    const { error } = await supabase.from('design_rules').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadRules();
}


/* ── ANALYTICS ────────────────────────────────── */
function initAnalytics() {
    // Placeholder for now. 
    // Real implementation would fetch from 'designs' table and aggregate.
}
