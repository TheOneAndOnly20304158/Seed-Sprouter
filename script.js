const SAVE_KEY = 'sprouter_pro_v10_final';
let state = {
    munz: 100, lifetimeMunz: 0, selectedSeed: null,
    inventory: { Basil: 0, Wheat: 0, Carrot: 0, Tomato: 0, Sunflower: 0 },
    barn: { Basil: 0, Wheat: 0, Carrot: 0, Tomato: 0, Sunflower: 0, Egg: 0, GoldEgg: 0 },
    plots: Array(25).fill(null),
    chickens: 0, eggsInNest: 0, gEggsInNest: 0, lastEggTime: Date.now(),
    shopStock: {}, currentShopID: "", view: 'garden', bowl: [],
    isInvasionActive: false
};

const cropData = {
    Basil:     { symbol: "🌿", price: 10,  time: 15,  sell: 15,  chance: 1.0,  max: 20 },
    Wheat:     { symbol: "🌾", price: 75,  time: 30,  sell: 100, chance: 0.7,  max: 15 },
    Carrot:    { symbol: "🥕", price: 50,  time: 45,  sell: 75,  chance: 0.8,  max: 12 },
    Tomato:    { symbol: "🍅", price: 100, time: 60,  sell: 125, chance: 0.4,  max: 8 },
    Sunflower: { symbol: "🌻", price: 200, time: 120, sell: 500, chance: 0.15, max: 4 }
};

let wolfSpawner, wolfThinker;

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function showFloatingText(text, color, x, y) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function updateRank() {
    const m = state.lifetimeMunz;
    let rank = "Newbie Farmer";
    if (m > 1000000) rank = "Legendary Farmer";
    else if (m > 150000) rank = "Grandmaster Farmer";
    else if (m > 50000) rank = "Master Farmer";
    else if (m > 5000) rank = "Advanced Farmer";
    document.getElementById('farmer-rank').textContent = rank;
}

function switchView(v) {
    state.view = v;
    document.getElementById('garden-view').style.display = v === 'garden' ? 'grid' : 'none';
    document.getElementById('farm-view').style.display = v === 'farm' ? 'block' : 'none';
    document.getElementById('kitchen-view').style.display = v === 'kitchen' ? 'flex' : 'none';
    document.getElementById('cookbook-box').style.display = v === 'kitchen' ? 'block' : 'none';
    renderShop();
    refreshUI();
}

function updateGlobalLogic() {
    const now = new Date();
    const min = now.getMinutes();
    const sec = now.getSeconds();

    if (min % 5 === 0 && !state.isInvasionActive) {
        startInvasion();
    } else if (min % 5 !== 0 && state.isInvasionActive) {
        endInvasion();
    }

    const isRaining = (min % 10 < 3);
    const isGolden = (min >= 50);
    document.body.className = isGolden ? 'golden' : (isRaining ? 'raining' : '');
    document.getElementById('weather-status').textContent = isRaining ? "🌧️ Raining" : (isGolden ? "✨ Golden Hour" : "☀️ Sunny");
    
    let timerTxt = isRaining ? `${2-(min%10)}m ${59-sec}s until Sun` : (min < 50 ? `${49-min}m ${59-sec}s until Golden` : `${59-min}m ${59-sec}s until Reset`);
    document.getElementById('weather-timer').textContent = timerTxt;
    document.getElementById('restock-timer').textContent = 59 - sec;

    const shopID = `${now.getHours()}-${min}`;
    if (state.currentShopID !== shopID) {
        state.currentShopID = shopID;
        state.shopStock = {};
        let seedBase = now.getFullYear() + now.getHours() + min;
        Object.keys(cropData).forEach((k, i) => {
            if (seededRandom(seedBase + i) < cropData[k].chance) {
                state.shopStock[k] = Math.floor(seededRandom(seedBase + i + 5) * cropData[k].max) + 1;
            }
        });
        renderShop();
    }

    if (state.chickens > 0 && Date.now() - state.lastEggTime >= 20000) {
        for(let i=0; i<state.chickens; i++) {
            if(Math.random() < 0.05) state.gEggsInNest++; else state.eggsInNest++;
        }
        state.lastEggTime = Date.now();
    }

    state.plots.forEach(p => { if (p && p.progress < 100) p.progress = Math.min(100, p.progress + ((isRaining?3:1)/p.time)*100); });
    refreshUI();
}

function renderShop() {
    const sEl = document.getElementById('shop-list'); sEl.innerHTML = '';
    if (state.view === 'farm') {
        sEl.innerHTML = `<div class="item-row">🐓 Chicken <button class="seed-btn" onclick="buyChicken()">💰500</button></div>`;
    } else {
        Object.keys(state.shopStock).forEach(k => {
            sEl.innerHTML += `<div class="item-row"><span>${cropData[k].symbol} ${k} (${state.shopStock[k]})</span><button class="seed-btn" onclick="buySeed('${k}')">💰${cropData[k].price}</button></div>`;
        });
    }
}

function refreshUI() {
    document.getElementById('munz').textContent = Math.floor(state.munz);
    document.getElementById('lifetime-munz').textContent = Math.floor(state.lifetimeMunz);
    document.getElementById('egg-count').textContent = state.eggsInNest;
    document.getElementById('gegg-count').textContent = state.gEggsInNest;
    document.getElementById('selected-txt').textContent = state.selectedSeed || "None";
    updateRank();

    const invEl = document.getElementById('inventory-list'); invEl.innerHTML = '';
    for (let k in state.inventory) if (state.inventory[k] > 0) {
        invEl.innerHTML += `<div class="item-row"><span>${cropData[k].symbol} x${state.inventory[k]}</span><button class="seed-btn ${state.selectedSeed===k?'active':''}" onclick="state.selectedSeed='${k}';refreshUI()">Hold</button></div>`;
    }

    const barnEl = document.getElementById('barn-list'); barnEl.innerHTML = '';
    for (let k in state.barn) if (state.barn[k] > 0) {
        const sym = k === 'Egg' ? '🥚' : k === 'GoldEgg' ? '✨' : cropData[k].symbol;
        let actionHtml = state.view === 'kitchen' ? `<button class="seed-btn" onclick="addToBowl('${k}')">Add</button>` : `<button class="sell-btn" onclick="sellItem('${k}')">Sell</button>`;
        barnEl.innerHTML += `<div class="item-row"><span>${sym} x${state.barn[k]}</span>${actionHtml}</div>`;
    }

    document.getElementById('bowl-contents').textContent = state.bowl.map(i => i === 'Egg' ? '🥚' : cropData[i].symbol).join(" ");

    state.plots.forEach((p, i) => {
        const el = document.getElementById(`p-${i}`);
        if (!p) { el.textContent = ''; el.style.background = "#8d6e63"; el.className = 'plot'; } 
        else {
            if (p.progress >= 100) { el.textContent = p.symbol; el.className = 'plot ready'; }
            else { el.textContent = '🌱'; el.style.background = `linear-gradient(to top, #4CAF50 ${p.progress}%, #8d6e63 ${p.progress}%)`; }
        }
    });
}

function buySeed(t) { if (state.munz >= cropData[t].price && state.shopStock[t] > 0) { state.munz -= cropData[t].price; state.inventory[t]++; state.shopStock[t]--; renderShop(); saveGame(); } }

function buyChicken() { 
    if (state.munz >= 500) { 
        state.munz -= 500; 
        state.chickens++; 
        createChickenSprite(); 
        saveGame(); 
        refreshUI();
    } 
}

function handlePlot(i, event) {
    const p = state.plots[i];
    if (p && p.progress >= 100) {
        const key = Object.keys(cropData).find(k => cropData[k].symbol === p.symbol);
        state.barn[key]++; state.plots[i] = null;
        showFloatingText("+1 " + p.symbol, "#4caf50", event.clientX, event.clientY);
    } else if (!p && state.selectedSeed && state.inventory[state.selectedSeed] > 0) {
        state.inventory[state.selectedSeed]--;
        state.plots[i] = { symbol: cropData[state.selectedSeed].symbol, time: cropData[state.selectedSeed].time, progress: 0 };
    }
    saveGame();
    refreshUI();
}

function addToBowl(item) { if (state.barn[item] > 0) { state.barn[item]--; state.bowl.push(item); refreshUI(); } }
function clearBowl() { state.bowl.forEach(item => state.barn[item]++); state.bowl = []; refreshUI(); }

function cookMeal() {
    if (state.bowl.length === 0) return;
    const counts = {};
    state.bowl.forEach(x => counts[x] = (counts[x] || 0) + 1);
    let res = { name: "Gooey Mess", val: 10 };
    
    if (counts.Carrot === 3 && counts.Wheat === 3) res = { name: "Carrot Cake 🎂", val: 1200 };
    else if (counts.Tomato === 4 && counts.Basil === 1) res = { name: "Tomato Soup 🥣", val: 900 };
    else if (counts.Egg === 5 && counts.Basil === 2) res = { name: "Egg Salad 🥗", val: 700 };

    alert("Chef cooked: " + res.name + "!");
    state.munz += res.val; state.lifetimeMunz += res.val;
    state.bowl = []; saveGame(); refreshUI();
}

function sellItem(t) {
    let val = (t==='Egg')?25:(t==='GoldEgg')?250:cropData[t].sell;
    if (new Date().getMinutes() >= 50) val *= 2;
    state.munz += val; state.lifetimeMunz += val;
    state.barn[t]--; saveGame(); refreshUI();
}

function sellAll() { for (let k in state.barn) { while(state.barn[k] > 0) sellItem(k); } }
function collectEggs() { state.barn.Egg += state.eggsInNest; state.barn.GoldEgg += state.gEggsInNest; state.eggsInNest = 0; state.gEggsInNest = 0; saveGame(); refreshUI(); }

function createChickenSprite() {
    const c = document.createElement('div'); c.className = 'chicken'; c.innerHTML = '🐓';
    c.style.left = Math.random() * 80 + '%'; c.style.top = Math.random() * 70 + '%';
    document.getElementById('pasture').appendChild(c);
    setInterval(() => { if(!state.isInvasionActive) { c.style.left = Math.random() * 80 + '%'; c.style.top = Math.random() * 70 + '%'; } }, 4000);
}

function startInvasion() {
    state.isInvasionActive = true;
    document.getElementById('farm-view').classList.add('invasion-alert');
    document.getElementById('farm-title').innerHTML = "⚠️ WOLF ATTACK! ⚠️";
    
    const spawnLoop = () => {
        if (!state.isInvasionActive) return;
        if (document.querySelectorAll('.wolf').length < 3) createWolf();
        wolfSpawner = setTimeout(spawnLoop, Math.random() * 10000 + 10000);
    };
    spawnLoop();
    wolfThinker = setInterval(moveWolves, 800);
}

function createWolf() {
    const w = document.createElement('div');
    w.className = 'wolf'; w.innerHTML = '🐺';
    w.style.left = '-50px'; w.style.top = Math.random() * 70 + '%';
    w.onclick = (e) => { 
        showFloatingText("SHOO!", "orange", e.clientX, e.clientY);
        w.remove(); 
    };
    document.getElementById('pasture').appendChild(w);
}

function moveWolves() {
    const wolves = document.querySelectorAll('.wolf');
    const chickens = document.querySelectorAll('.chicken');
    wolves.forEach(wolf => {
        if (chickens.length > 0) {
            const target = chickens[0];
            const tX = parseFloat(target.style.left), tY = parseFloat(target.style.top);
            const wX = parseFloat(wolf.style.left), wY = parseFloat(wolf.style.top);
            wolf.style.left = (wX + (tX > wX ? 4 : -4)) + '%';
            wolf.style.top = (wY + (tY > wY ? 4 : -4)) + '%';
            if (Math.abs(wX - tX) < 6 && Math.abs(wY - tY) < 6) {
                target.remove(); state.chickens--;
                showFloatingText("CHOMP!", "red", wolf.offsetLeft, wolf.offsetTop);
                saveGame();
            }
        } else { wolf.style.left = (parseFloat(wolf.style.left) + 5) + '%'; if(parseFloat(wolf.style.left) > 100) wolf.remove(); }
    });
}

function endInvasion() {
    state.isInvasionActive = false;
    document.getElementById('farm-view').classList.remove('invasion-alert');
    document.getElementById('farm-title').innerHTML = "Chicken Pasture";
    document.querySelectorAll('.wolf').forEach(w => w.remove());
    clearTimeout(wolfSpawner); clearInterval(wolfThinker);
}

function saveGame() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function loadGame() {
    const s = localStorage.getItem(SAVE_KEY);
    if (s) { 
        state = Object.assign(state, JSON.parse(s)); 
        document.getElementById('pasture').innerHTML = '';
        for(let i=0; i<state.chickens; i++) createChickenSprite(); 
    }
}
function wipeSave() { if(confirm("Permanently delete data?")) { localStorage.removeItem(SAVE_KEY); location.reload(); } }
function exportSave() { document.getElementById('saveCode').value = btoa(JSON.stringify(state)); }
function importSave() { try { state = JSON.parse(atob(document.getElementById('saveCode').value)); saveGame(); location.reload(); } catch(e) { alert("Invalid Code"); } }

function init() {
    loadGame();
    const grid = document.getElementById('garden-view');
    for(let i=0; i<25; i++) {
        const el = document.createElement('div'); el.className = 'plot'; el.id = `p-${i}`; el.onclick = (e) => handlePlot(i, e);
        grid.appendChild(el);
    }
    setInterval(updateGlobalLogic, 1000);
    renderShop();
}
init();
