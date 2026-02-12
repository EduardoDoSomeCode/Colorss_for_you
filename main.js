const palette = document.getElementById("palette");
const historyEl = document.getElementById("history");
let dragged = null;
let hovered = null;
let isVertical = false; // NEW
const history = []; // NEW
const MAX_HISTORY = 10;

// Add this near the top of main.js (after const declarations)
function svgIcon(name) {
    const icons = {
        lock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
        unlock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
        trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H6v2h12V4z"/></svg>`,
        palette: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
    };
    return icons[name] || "";
}

/* -------------------------
   Color helpers
-------------------------- */
function randomColor() {
    return "#" + Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0");
}

/* WCAG luminance check */
function getTextColor(hex) {
    const rgb = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255)
        .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

    const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return luminance > 0.5 ? "#000" : "#fff";
}

/* -------------------------
   Layout logic
-------------------------- */
function recalcSizes() {
    const blocks = [...palette.children];
    blocks.forEach(b => b.style.flex = 1);

    if (!isVertical && blocks.length >= 3) {
        blocks[0].style.flex = 6;
        blocks[1].style.flex = 3;
        blocks[2].style.flex = 1;
    }
}

function saveHistory() {
    const snapshot = {
        id: crypto.randomUUID(),
        favorite: false,
        colors: [...palette.children].map(block => ({
            hex: block.dataset.hex,
            lock: block.dataset.lock,
            hue: block.dataset.hue
        }))
    };
    const last = history[0];
    if (last && JSON.stringify(last.colors) === JSON.stringify(snapshot.colors)) return;

    history.unshift(snapshot);
    if (history.length > MAX_HISTORY) history.pop();
    persistFavorites();
    renderHistory(); // ✅ THIS WAS MISSING
}

function renderHistory() {
    historyEl.innerHTML = "";

    history.forEach(entry => {
        const mini = document.createElement("div");
        mini.className = "history-item";

        entry.colors.forEach(color => {
            const swatch = document.createElement("span");
            swatch.style.background = color.hex;
            mini.appendChild(swatch);
        });

        // ⭐ favorite toggle
        const fav = document.createElement("button");
        fav.className = "fav-btn";
        fav.innerHTML = entry.favorite ? "&#9733;" : "&#9734;"; // ★ ☆

        fav.onclick = (e) => {
            e.stopPropagation();
            entry.favorite = !entry.favorite;
            persistFavorites();
            renderHistory();
        };

        mini.appendChild(fav);

        // FIX: Pass the full entry object, not just entry.colors
        mini.onclick = () => restorePalette(entry);

        historyEl.appendChild(mini);
    });
}

function persistFavorites() {
    localStorage.setItem("paletteFavorites", JSON.stringify(history));
}

function loadFavorites() {
    const saved = localStorage.getItem("paletteFavorites");
    if (!saved) return;

    history.length = 0;
    history.push(...JSON.parse(saved));
}

document.getElementById("layout").onclick = () => {
    isVertical = !isVertical;

    // CSS handles direction, JS handles logic
    palette.classList.toggle("vertical", isVertical);

    recalcSizes();
};

/* -------------------------
   Create color column
-------------------------- */

function createBlock() {
    const div = document.createElement("div");
    div.className = "color";
    div.draggable = true;
    div.dataset.lock = "none"; // none | full | hue
    div.dataset.hue = "";

    const label = document.createElement("span");
    label.className = "label";

    /* Click-to-copy HEX */
    label.onclick = async () => {
        await navigator.clipboard.writeText(label.textContent);
        label.textContent = "Copied!";
        setTimeout(() => {
            label.textContent = div.dataset.hex;
        }, 700);
    };

    const controls = document.createElement("div");
    controls.className = "controls";

    const lock = document.createElement("button");
    lock.className = "btn";
    lock.innerHTML = "&#128273;"; // 🔓

    lock.onclick = () => toggleFullLock(div, lock);

    const remove = document.createElement("button");
    remove.className = "btn";
    remove.innerHTML = "&#128465;"; // 🗑

    const hueLock = document.createElement("button");
    hueLock.className = "btn";
    hueLock.innerHTML = "&#127916;"; // 🎨
    hueLock.onclick = () => toggleHueLock(div, hueLock);

    remove.onclick = () => {
        if (palette.children.length > 1) {
            div.remove();
            recalcSizes();
        }
    };

    controls.append(lock, hueLock, remove);
    div.append(label, controls);

    /* Hover tracking (for keyboard shortcuts) */
    div.addEventListener("mouseenter", () => hovered = div);
    div.addEventListener("mouseleave", () => hovered = null);

    /* Drag & drop */
    div.addEventListener("dragstart", () => {
        dragged = div;
        div.classList.add("dragging");
    });

    div.addEventListener("dragend", () => {
        dragged = null;
        div.classList.remove("dragging");
    });

    div.addEventListener("dragover", e => e.preventDefault());

    div.addEventListener("drop", () => {
        if (dragged && dragged !== div) {
            saveHistory(); // ⬅️ snapshot
            const nodes = [...palette.children];
            const from = nodes.indexOf(dragged);
            const to = nodes.indexOf(div);

            palette.insertBefore(
                dragged,
                from < to ? div.nextSibling : div
            );
            recalcSizes();
        }
    });

    return div;
}

/* -------------------------
   Lock toggle
-------------------------- */

function toggleFullLock(div, btn) {
    div.dataset.lock = div.dataset.lock === "full" ? "none" : "full";
    btn.innerHTML = div.dataset.lock === "full" ? "&#128274;" : "&#128273;"; // 🔒 🔓
}

function toggleHueLock(div, btn) {
    div.dataset.lock = div.dataset.lock === "hue" ? "none" : "hue";
    btn.classList.toggle("active", div.dataset.lock === "hue");
}

/* -------------------------
   Generate colors
-------------------------- */
function generate() {
    [...palette.children].forEach(block => {
        if (block.dataset.lock === "full") return;

        let hue;

        if (block.dataset.lock === "hue") {
            hue = Number(block.dataset.hue);
        } else {
            hue = Math.random() * 360;
        }

        const hsl = randomHSL(hue);
        const hex = hslToHex(hsl.h, hsl.s, hsl.l);

        block.dataset.hue = hsl.h;
        block.dataset.hex = hex;

        block.style.background = hex;
        block.style.color = getTextColor(hex);
        block.querySelector(".label").textContent = hex;

        updateContrast(block);
    });
    saveHistory();
}

function luminance(rgb) {
    return rgb.map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function contrastRatio(bgHex, textHex) {
    const bg = bgHex.match(/\w\w/g).map(v => parseInt(v, 16));
    const text = textHex === "#000" ? [0, 0, 0] : [255, 255, 255];

    const L1 = luminance(bg) + 0.05;
    const L2 = luminance(text) + 0.05;

    return (Math.max(L1, L2) / Math.min(L1, L2)).toFixed(2);
}

function updateContrast(block) {
    let ratioEl = block.querySelector(".ratio");

    if (!ratioEl) {
        ratioEl = document.createElement("div");
        ratioEl.className = "ratio";
        block.appendChild(ratioEl);
    }

    //ratioEl.textContent = `Contrast ${contrastRatio(block.dataset.hex, block.style.color)}`;
}

function restorePalette(snapshot) {
    palette.innerHTML = ""; // Clear existing blocks

    snapshot.colors.forEach(item => {
        const block = createBlock(); // Create a new block
        block.dataset.hex = item.hex;
        block.dataset.lock = item.lock;
        block.dataset.hue = item.hue;

        block.style.background = item.hex;
        block.style.color = getTextColor(item.hex);
        block.querySelector(".label").textContent = item.hex;

        // Restore lock state
        const lockBtn = block.querySelector(".btn:first-child");
        if (item.lock === "full") {
            toggleFullLock(block, lockBtn); // Apply lock state
        } else if (item.lock === "hue") {
            toggleHueLock(block, lockBtn); // Apply hue-lock state
        }

        palette.appendChild(block); // Add block to palette
    });

    recalcSizes(); // Recalculate layout
}

function randomHSL(hue = Math.random() * 360) {
    const s = Math.floor(40 + Math.random() * 50);
    const l = Math.floor(30 + Math.random() * 50);
    return { h: hue, s, l };
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/* -------------------------
   Keyboard shortcuts
-------------------------- */
document.addEventListener("keydown", e => {
    if (!hovered) return;

    if (e.key.toLowerCase() === "l") {
        const lockBtn = hovered.querySelector(".btn");
        toggleFullLock(hovered, lockBtn);
    }

    if (e.key === "Delete" || e.key === "Backspace") {
        if (palette.children.length > 1) {
            hovered.remove();
            hovered = null;
            recalcSizes();
        }
    }
});

/* -------------------------
   Buttons
-------------------------- */
document.getElementById("undo").onclick = () => {
    if (history.length > 1) {
        history.shift(); // Remove current state
        restorePalette(history[0]); // Restore previous state
        renderHistory(); // Refresh history display
    }
};
document.getElementById("redo").onclick = () => {
    if (history.length > 1) {
        const lastState = history.shift(); // Move current state to redo stack
        restorePalette(history[0]); // Restore next state
        history.unshift(lastState); // Add back to history for redo
        renderHistory(); // Refresh history display
    }
};
document.getElementById("generate").onclick = generate;

document.getElementById("add").onclick = () => {
    saveHistory(); // ⬅️ snapshot
    palette.appendChild(createBlock());
    generate();
    recalcSizes();
};

document.getElementById("export").onclick = () => {
    html2canvas(palette).then(canvas => {
        const a = document.createElement("a");
        a.download = "palette.png";
        a.href = canvas.toDataURL();
        a.click();
    });
};

/* Init */
for (let i = 0; i < 3; i++) palette.appendChild(createBlock());
generate();
recalcSizes();