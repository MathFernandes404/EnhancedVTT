// content.js
console.log("Enhanced VTT: Content script carregado.");

let isPanelOpen = false;

function updateThemeClass(panel) {
  if (!panel) return;
  
  // Roll20 dark mode detection: check computed background color of body/page
  let isDark = false;
  
  // Method 1: Check body classes (Roll20 adds these in some versions)
  const bodyClasses = document.body.className || "";
  if (/dark|darkmode|theme-dark/i.test(bodyClasses)) {
    isDark = true;
  }
  
  // Method 2: Check computed background color brightness
  if (!isDark) {
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const brightness = (parseInt(match[1]) * 299 + parseInt(match[2]) * 587 + parseInt(match[3]) * 114) / 1000;
      isDark = brightness < 128;
    }
  }
  
  // Method 3: Check if the Roll20 editor canvas area has dark styling
  if (!isDark) {
    const editor = document.getElementById("editor-wrapper") || document.getElementById("editor");
    if (editor) {
      const edBg = window.getComputedStyle(editor).backgroundColor;
      const m = edBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const b = (parseInt(m[1]) * 299 + parseInt(m[2]) * 587 + parseInt(m[3]) * 114) / 1000;
        isDark = b < 128;
      }
    }
  }
  
  if (isDark) {
    panel.classList.add("evtt-dark");
    panel.classList.remove("evtt-light");
  } else {
    panel.classList.add("evtt-light");
    panel.classList.remove("evtt-dark");
  }
}

// Injecting UI Panel HTML
function injectPanel() {
  if (!document.body) {
    setTimeout(injectPanel, 100);
    return;
  }
  if (document.getElementById("evtt-app-root")) return;

  const panelContainer = document.createElement("div");
  panelContainer.id = "evtt-app-root";
  panelContainer.className = "evtt-minimized"; // Start minimized
  
  // Fetch HTML structure
  const htmlUrl = chrome.runtime.getURL("ui/panel.html");
  fetch(htmlUrl)
    .then(res => res.text())
    .then(html => {
      panelContainer.innerHTML = html;
      document.body.appendChild(panelContainer);
      updateThemeClass(panelContainer);
      
      const themeObserver = new MutationObserver(() => {
        updateThemeClass(panelContainer);
      });
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      
      setupPanelListeners();
    })
    .catch(err => console.error("Erro ao carregar UI:", err));
}

function injectSettingsButton() {
  try {
    // 1. Tenta achar a aba de configurações de forma clássica por ID ou classe
    let settingsTab = document.getElementById("settings") || document.querySelector(".tab-content#settings") || document.querySelector(".settings");
    
    // 2. Se não achar por ID direto, faz a busca pelo botão de "Sair do Jogo" (Exit Game) que sempre existe nessa aba
    let exitBtn = null;
    if (!settingsTab) {
      const candidates = document.querySelectorAll("button, a, .btn");
      for (let i = 0; i < candidates.length; i++) {
        const text = candidates[i].textContent || "";
        if (text.includes("Sair do Jogo") || text.includes("Exit Game") || text.includes("Sair do jogo") || text.includes("Sair do Jogo")) {
          exitBtn = candidates[i];
          break;
        }
      }
      if (exitBtn) {
        // Encontra o container ancestral que parece ser o painel da aba
        settingsTab = exitBtn.closest(".tab-pane") || exitBtn.closest("#settings") || exitBtn.closest(".tab-content") || exitBtn.parentNode;
      }
    }

    if (!settingsTab) return;
    if (settingsTab.querySelector("#evtt-settings-section")) return;

    const container = document.createElement("div");
    container.id = "evtt-settings-section";
    Object.assign(container.style, {
      marginTop: "10px",
      marginBottom: "10px",
      marginLeft: "15px",
      marginRight: "15px",
      padding: "12px",
      background: "#2a2a2a",
      border: "1px solid #444",
      borderRadius: "6px",
      color: "#fff",
      fontFamily: "inherit",
      boxSizing: "border-box"
    });

    const title = document.createElement("div");
    title.textContent = "Enhanced VTT";
    Object.assign(title.style, {
      fontSize: "12px",
      fontWeight: "bold",
      color: "#E91E63",
      marginBottom: "8px",
      textTransform: "uppercase",
      letterSpacing: "1px"
    });

    const openBtn = document.createElement("button");
    openBtn.textContent = "Abrir Enhanced VTT";
    openBtn.className = "btn"; // Roll20 default style class
    Object.assign(openBtn.style, {
      width: "100%",
      background: "#E91E63",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      cursor: "pointer",
      fontWeight: "600",
      transition: "background 0.2s"
    });
    
    openBtn.addEventListener("mouseenter", () => {
      openBtn.style.background = "#D81B60";
    });
    openBtn.addEventListener("mouseleave", () => {
      openBtn.style.background = "#E91E63";
    });

    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      togglePanel();
    });

    container.appendChild(title);
    container.appendChild(openBtn);

    // Tenta encontrar o botão "Entrar como Jogador" ou o botão de "Sair do Jogo" para posicionar antes dele
    const buttons = settingsTab.querySelectorAll("button, a");
    let targetEl = null;
    
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = btn.textContent || "";
      let className = "";
      if (typeof btn.className === "string") {
        className = btn.className;
      } else if (btn.className && typeof btn.className.baseVal === "string") {
        className = btn.className.baseVal;
      }

      // Procura primeiro por "Entrar como Jogador"
      if (text.includes("Jogador") || text.includes("Player") || className.includes("rejoin")) {
        targetEl = btn;
        break;
      }
    }

    // Se não achou o de jogador, procura pelo botão de sair do jogo para inserir acima dele
    if (!targetEl) {
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const text = btn.textContent || "";
        if (text.includes("Sair do Jogo") || text.includes("Exit Game") || text.includes("Sair do jogo")) {
          targetEl = btn;
          break;
        }
      }
    }

    if (targetEl) {
      // Insere antes do botão alvo ou antes do parágrafo que o envolve
      const parentParagraph = targetEl.closest("p") || targetEl;
      parentParagraph.parentNode.insertBefore(container, parentParagraph);
    } else {
      // Fallback: anexa no final
      settingsTab.appendChild(container);
    }
    console.log("EVTT: Settings button successfully injected.");
  } catch (err) {
    console.error("EVTT: Error in injectSettingsButton:", err);
  }
}

setInterval(injectSettingsButton, 1000);

// Injecting the page script to access window.Campaign
function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Global variable to cache sync data for client-side search/filters
let cachedCampaignData = { characters: [], handouts: [] };

function setupPanelListeners() {
  const closeBtn = document.getElementById("evtt-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      togglePanel();
    });
  }
  
  const panel = document.getElementById("evtt-app-root");
  const dragHandle = document.getElementById("evtt-drag-handle");
  const collapseBtn = document.getElementById("evtt-collapse-btn");

  function toggleCollapse() {
    if (panel) {
      panel.classList.toggle("evtt-collapsed");
      if (collapseBtn) {
        const isCollapsed = panel.classList.contains("evtt-collapsed");
        collapseBtn.innerHTML = isCollapsed ? "&#x25bc;" : "&#x2212;"; // ▼ or −
        collapseBtn.title = isCollapsed ? "Expandir" : "Minimizar";
      }
    }
  }

  if (dragHandle) {
    dragHandle.addEventListener("dblclick", (e) => {
      // Prevent minimize if clicking controls/buttons in the header
      if (e.target.closest('.evtt-icon-btn')) return;
      toggleCollapse();
    });
  }

  if (collapseBtn) {
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapse();
    });
  }

  // Setup search and filter input event listeners
  const searchInput = document.getElementById("evtt-search");
  const filterChars = document.getElementById("filter-chars");
  const filterHandouts = document.getElementById("filter-handouts");

  if (searchInput) {
    searchInput.addEventListener("input", filterAndRenderList);
  }
  if (filterChars) {
    filterChars.addEventListener("change", filterAndRenderList);
  }
  if (filterHandouts) {
    filterHandouts.addEventListener("change", filterAndRenderList);
  }

  if (panel) setupDraggable(panel);
  
  // Ouça mensagens do script injetado
  window.addEventListener("message", (event) => {
    // Apenas aceite mensagens da própria página
    if (event.source !== window) return;
    
    if (event.data.type && event.data.type === "EVTT_DATA_SYNC") {
      cachedCampaignData = event.data.payload;
      filterAndRenderList();
    }

    if (event.data.type && event.data.type === "EVTT_CHARACTER_ATTRIBUTES_SYNC") {
      const { id, attributes } = event.data.payload;
      if (activeItem && activeItem.id === id) {
        activeItem.attributes = attributes;
        
        // Atualiza os dropdowns da UI na hora!
        const bar1Select = document.getElementById("evtt-bar1-link");
        const bar2Select = document.getElementById("evtt-bar2-link");
        const bar3Select = document.getElementById("evtt-bar3-link");
        
        [bar1Select, bar2Select, bar3Select].forEach(select => {
          if (!select) return;
          const currVal = select.value;
          select.innerHTML = '<option value="">Nenhum Atributo</option>';
          
          attributes.forEach(attr => {
            const opt = document.createElement("option");
            opt.value = attr.id;
            opt.textContent = attr.name;
            select.appendChild(opt);
          });
          
          // Restaura valor anterior se existir na lista
          select.value = currVal;
        });
      }
    }
  });
  
  // Botão de refresh
  document.getElementById("evtt-refresh-btn")?.addEventListener("click", () => {
    window.postMessage({ type: "EVTT_REQUEST_DATA" }, "*");
  });
}

function togglePanel() {
  const panel = document.getElementById("evtt-app-root");
  if (panel) {
    panel.classList.toggle("evtt-minimized");
    
    if (!panel.classList.contains("evtt-minimized")) {
      window.postMessage({ type: "EVTT_REQUEST_DATA" }, "*");
    }
  } else {
    injectPanel();
    setTimeout(togglePanel, 200);
  }
}

let activeItem = null;

function filterAndRenderList() {
  const listEl = document.getElementById("evtt-character-list");
  if (!listEl) return;
  
  const searchInput = document.getElementById("evtt-search");
  const filterChars = document.getElementById("filter-chars");
  const filterHandouts = document.getElementById("filter-handouts");
  
  const query = searchInput ? searchInput.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
  const includeChars = filterChars ? filterChars.checked : true;
  const includeHandouts = filterHandouts ? filterHandouts.checked : true;

  listEl.innerHTML = "";
  
  let items = [];
  if (cachedCampaignData.characters && includeChars) {
    items = items.concat(cachedCampaignData.characters);
  }
  if (cachedCampaignData.handouts && includeHandouts) {
    items = items.concat(cachedCampaignData.handouts);
  }

  // Filtra por busca usando correspondência normalizada para acentos
  if (query) {
    items = items.filter(item => {
      const nameNormalized = (item.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nameNormalized.includes(query);
    });
  }

  // Renderiza a lista filtrada
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "evtt-list-item";
    
    if (activeItem && activeItem.id === item.id) {
      div.classList.add("evtt-list-item-active");
    }
    
    const imgUrl = item.avatar || chrome.runtime.getURL("assets/placeholder.png");
    
    div.innerHTML = `
      <img src="${imgUrl}" alt="${item.name}" class="evtt-item-img" onerror="this.src='${chrome.runtime.getURL("assets/placeholder.png")}'" />
      <span class="evtt-item-name">${item.name}</span>
    `;
    
    div.addEventListener("click", () => {
      const activeItems = listEl.querySelectorAll(".evtt-list-item-active");
      activeItems.forEach(el => el.classList.remove("evtt-list-item-active"));
      
      div.classList.add("evtt-list-item-active");
      activeItem = item;
      showItemDetails(item);
    });
    
    listEl.appendChild(div);
  });
}

function updatePanelList(data) {
  cachedCampaignData = data;
  filterAndRenderList();
}

function showItemDetails(item) {
  document.querySelector(".evtt-empty-state").style.display = "none";
  document.getElementById("evtt-item-details").style.display = "block";
  
  const imgEl = document.getElementById("evtt-detail-img");
  imgEl.src = item.avatar || chrome.runtime.getURL("assets/placeholder.png");
  
  const imgUrlInput = document.getElementById("evtt-img-url");
  imgUrlInput.value = item.avatar || "";
  
  // Set up token preview
  const tokenPreviewImg = document.getElementById("evtt-token-preview-img");
  const tokenImgUrlInput = document.getElementById("evtt-token-img-url");
  tokenImgUrlInput.value = "";
  if (tokenPreviewImg) {
    tokenPreviewImg.src = item.avatar || chrome.runtime.getURL("assets/placeholder.png");
  }
  tokenImgUrlInput.addEventListener("input", (e) => {
    if (tokenPreviewImg) {
      tokenPreviewImg.src = e.target.value || item.avatar || chrome.runtime.getURL("assets/placeholder.png");
    }
  });

  // Populate attribute link dropdowns using cached attributes first
  const bar1Select = document.getElementById("evtt-bar1-link");
  const bar2Select = document.getElementById("evtt-bar2-link");
  const bar3Select = document.getElementById("evtt-bar3-link");
  
  [bar1Select, bar2Select, bar3Select].forEach((select, index) => {
    if (!select) return;
    select.innerHTML = '<option value="">Nenhum Atributo</option>';
    if (item.type === "character" && item.attributes) {
      item.attributes.forEach(attr => {
        const opt = document.createElement("option");
        opt.value = attr.id;
        opt.textContent = attr.name;
        select.appendChild(opt);
      });
    }
    
    // Configura autopreenchimento no change
    select.onchange = () => {
      autoFillBarValues(index + 1, select.value);
    };
  });

  // Solicita os atributos em tempo real para sincronização instantânea
  if (item.type === "character") {
    window.postMessage({
      type: "EVTT_REQUEST_CHARACTER_ATTRIBUTES",
      payload: { id: item.id }
    }, "*");
  }

  // Set up button listeners (remove old ones by cloning or handling properly)
  const updateBtn = document.getElementById("evtt-update-img-btn");
  updateBtn.onclick = () => {
    const newUrl = imgUrlInput.value.trim();
    if (newUrl) {
      window.postMessage({
        type: "EVTT_UPDATE_IMAGE",
        payload: { id: item.id, type: item.type, url: newUrl }
      }, "*");
    }
  };
  
  const exportBtn = document.getElementById("evtt-export-json");
  exportBtn.onclick = () => {
    window.postMessage({
      type: "EVTT_EXPORT_JSON",
      payload: { id: item.id, type: item.type }
    }, "*");
  };
  
  const importBtn = document.getElementById("evtt-import-json");
  importBtn.onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const json = JSON.parse(ev.target.result);
          window.postMessage({
            type: "EVTT_IMPORT_JSON",
            payload: { id: item.id, type: item.type, data: json }
          }, "*");
        } catch (err) {
          alert("Arquivo JSON inválido!");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Config Token Toggle
  const tokenConfigBtn = document.getElementById("evtt-token-config");
  const tokenConfigArea = document.getElementById("evtt-token-config-area");
  tokenConfigBtn.onclick = () => {
    tokenConfigArea.style.display = tokenConfigArea.style.display === "none" ? "block" : "none";
    // Fecha galeria se abrir edição
    if (tokenConfigArea.style.display === "block" && galleryArea) {
      galleryArea.style.display = "none";
    }
  };
  
  // Config Galeria Toggle
  const galleryBtn = document.getElementById("evtt-open-gallery");
  const galleryArea = document.getElementById("evtt-gallery-area");
  if (galleryBtn && galleryArea) {
    galleryBtn.onclick = () => {
      galleryArea.style.display = galleryArea.style.display === "none" ? "block" : "none";
      if (galleryArea.style.display === "block") {
        // Fecha formulário se abrir galeria
        tokenConfigArea.style.display = "none";
        loadAndRenderGallery(item);
      }
    };
  }

  // Botão de salvar configuração atual na galeria
  const gallerySaveBtn = document.getElementById("evtt-gallery-save-btn");
  if (gallerySaveBtn) {
    gallerySaveBtn.onclick = () => {
      const name = prompt("Digite um nome para esta configuração de token (ex: Combate, Furtivo, Montado):");
      if (!name) return;
      
      const config = {
        imgsrc: document.getElementById("evtt-token-img-url").value,
        width: document.getElementById("evtt-token-width").value,
        height: document.getElementById("evtt-token-height").value,
        aura1_radius: document.getElementById("evtt-aura1-radius").value,
        aura1_color: document.getElementById("evtt-aura1-color").value,
        aura1_shape: document.getElementById("evtt-aura1-shape").value,
        aura2_radius: document.getElementById("evtt-aura2-radius").value,
        aura2_color: document.getElementById("evtt-aura2-color").value,
        aura2_shape: document.getElementById("evtt-aura2-shape").value,
        bar1_value: document.getElementById("evtt-bar1-value").value,
        bar1_max: document.getElementById("evtt-bar1-max").value,
        bar1_link: document.getElementById("evtt-bar1-link").value,
        bar2_value: document.getElementById("evtt-bar2-value").value,
        bar2_max: document.getElementById("evtt-bar2-max").value,
        bar2_link: document.getElementById("evtt-bar2-link").value,
        bar3_value: document.getElementById("evtt-bar3-value").value,
        bar3_max: document.getElementById("evtt-bar3-max").value,
        bar3_link: document.getElementById("evtt-bar3-link").value
      };

      const key = `evtt_gallery_${item.id}`;
      chrome.storage.local.get([key], (result) => {
        const list = result[key] || [];
        list.push({
          id: Date.now(),
          name: name.trim(),
          config: config
        });
        
        chrome.storage.local.set({ [key]: list }, () => {
          loadAndRenderGallery(item);
        });
      });
    };
  }
  
  // Apply Token
  const applyTokenBtn = document.getElementById("evtt-apply-token");
  applyTokenBtn.onclick = () => {
    const config = {
      imgsrc: document.getElementById("evtt-token-img-url").value,
      width: document.getElementById("evtt-token-width").value,
      height: document.getElementById("evtt-token-height").value,
      aura1_radius: document.getElementById("evtt-aura1-radius").value,
      aura1_color: document.getElementById("evtt-aura1-color").value,
      aura1_shape: document.getElementById("evtt-aura1-shape").value,
      aura2_radius: document.getElementById("evtt-aura2-radius").value,
      aura2_color: document.getElementById("evtt-aura2-color").value,
      aura2_shape: document.getElementById("evtt-aura2-shape").value,
      bar1_value: document.getElementById("evtt-bar1-value").value,
      bar1_max: document.getElementById("evtt-bar1-max").value,
      bar1_link: document.getElementById("evtt-bar1-link").value,
      bar2_value: document.getElementById("evtt-bar2-value").value,
      bar2_max: document.getElementById("evtt-bar2-max").value,
      bar2_link: document.getElementById("evtt-bar2-link").value,
      bar3_value: document.getElementById("evtt-bar3-value").value,
      bar3_max: document.getElementById("evtt-bar3-max").value,
      bar3_link: document.getElementById("evtt-bar3-link").value
    };
    
    window.postMessage({
      type: "EVTT_UPDATE_TOKEN",
      payload: { id: item.id, config }
    }, "*");
  };
}

function loadAndRenderGallery(item) {
  const galleryList = document.getElementById("evtt-gallery-list");
  if (!galleryList) return;
  
  galleryList.innerHTML = '<div style="color: #888; font-style: italic; font-size: 11px;">Carregando...</div>';
  
  const key = `evtt_gallery_${item.id}`;
  chrome.storage.local.get([key], (result) => {
    const list = result[key] || [];
    galleryList.innerHTML = "";
    
    if (list.length === 0) {
      galleryList.innerHTML = '<div style="color: #888; font-style: italic; font-size: 11px; text-align: center; padding: 15px 0;">Nenhum token salvo nesta galeria.</div>';
      return;
    }
    
    list.forEach(entry => {
      const div = document.createElement("div");
      div.className = "evtt-gallery-item";
      div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 5px;";
      
      const imgUrl = entry.config.imgsrc || item.avatar || chrome.runtime.getURL("assets/placeholder.png");
      
      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${imgUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='${chrome.runtime.getURL("assets/placeholder.png")}'" />
          <span style="font-size: 12px; font-weight: 500; color: #eee;">${entry.name}</span>
        </div>
        <div style="display: flex; gap: 5px;">
          <button class="evtt-btn evtt-btn-apply" style="padding: 3px 8px; font-size: 10px; background: #E91E63; border: none; cursor: pointer; color: white; border-radius: 4px; font-weight: 600; margin: 0; width: auto;">Aplicar</button>
          <button class="evtt-btn evtt-btn-delete" style="padding: 3px 8px; font-size: 10px; background: rgba(255,0,0,0.15); border: none; cursor: pointer; color: #ff5555; border-radius: 4px; margin: 0; width: auto;">Excluir</button>
        </div>
      `;
      
      div.querySelector(".evtt-btn-apply").onclick = () => {
        window.postMessage({
          type: "EVTT_UPDATE_TOKEN",
          payload: { id: item.id, config: entry.config }
        }, "*");
        
        fillTokenInputs(entry.config);
      };
      
      div.querySelector(".evtt-btn-delete").onclick = () => {
        if (confirm(`Deseja realmente excluir a configuração "${entry.name}"?`)) {
          const updatedList = list.filter(x => x.id !== entry.id);
          chrome.storage.local.set({ [key]: updatedList }, () => {
            loadAndRenderGallery(item);
          });
        }
      };
      
      galleryList.appendChild(div);
    });
  });
}

function fillTokenInputs(config) {
  if (document.getElementById("evtt-token-img-url")) document.getElementById("evtt-token-img-url").value = config.imgsrc || "";
  if (document.getElementById("evtt-token-width")) document.getElementById("evtt-token-width").value = config.width || "";
  if (document.getElementById("evtt-token-height")) document.getElementById("evtt-token-height").value = config.height || "";
  if (document.getElementById("evtt-aura1-radius")) document.getElementById("evtt-aura1-radius").value = config.aura1_radius || "";
  if (document.getElementById("evtt-aura1-color")) document.getElementById("evtt-aura1-color").value = config.aura1_color || "#ffff00";
  if (document.getElementById("evtt-aura1-shape")) document.getElementById("evtt-aura1-shape").value = config.aura1_shape || "round";
  if (document.getElementById("evtt-aura2-radius")) document.getElementById("evtt-aura2-radius").value = config.aura2_radius || "";
  if (document.getElementById("evtt-aura2-color")) document.getElementById("evtt-aura2-color").value = config.aura2_color || "#ff0000";
  if (document.getElementById("evtt-aura2-shape")) document.getElementById("evtt-aura2-shape").value = config.aura2_shape || "round";
  if (document.getElementById("evtt-bar1-value")) document.getElementById("evtt-bar1-value").value = config.bar1_value || "";
  if (document.getElementById("evtt-bar1-max")) document.getElementById("evtt-bar1-max").value = config.bar1_max || "";
  if (document.getElementById("evtt-bar1-link")) document.getElementById("evtt-bar1-link").value = config.bar1_link || "";
  if (document.getElementById("evtt-bar2-value")) document.getElementById("evtt-bar2-value").value = config.bar2_value || "";
  if (document.getElementById("evtt-bar2-max")) document.getElementById("evtt-bar2-max").value = config.bar2_max || "";
  if (document.getElementById("evtt-bar2-link")) document.getElementById("evtt-bar2-link").value = config.bar2_link || "";
  if (document.getElementById("evtt-bar3-value")) document.getElementById("evtt-bar3-value").value = config.bar3_value || "";
  if (document.getElementById("evtt-bar3-max")) document.getElementById("evtt-bar3-max").value = config.bar3_max || "";
  if (document.getElementById("evtt-bar3-link")) document.getElementById("evtt-bar3-link").value = config.bar3_link || "";
  
  const tokenPreviewImg = document.getElementById("evtt-token-preview-img");
  if (tokenPreviewImg) {
    tokenPreviewImg.src = config.imgsrc || document.getElementById("evtt-detail-img").src;
  }
}

function autoFillBarValues(barNum, attrId) {
  if (!activeItem || !activeItem.attributes) return;
  
  const valInput = document.getElementById(`evtt-bar${barNum}-value`);
  const maxInput = document.getElementById(`evtt-bar${barNum}-max`);
  
  if (!attrId) {
    // Se "Nenhum Atributo" for selecionado, limpa os campos
    if (valInput) valInput.value = "";
    if (maxInput) maxInput.value = "";
    return;
  }
  
  const attr = activeItem.attributes.find(a => a.id === attrId);
  if (attr) {
    if (valInput) valInput.value = attr.current !== undefined && attr.current !== null ? attr.current : "";
    if (maxInput) maxInput.value = attr.max !== undefined && attr.max !== null ? attr.max : "";
  }
}

// Lógica de arrastar a janela (Draggable)
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

function setupDraggable(panel) {
  const dragHandle = document.getElementById("evtt-drag-handle");
  if (!dragHandle) return;

  dragHandle.addEventListener("mousedown", dragStart);
  window.addEventListener("mouseup", dragEnd);
  window.addEventListener("mousemove", drag);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target.closest('.evtt-icon-btn')) return; // Ignore clicks on buttons
    isDragging = true;
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      
      // We keep standard positioning fixed, and use transform for drag. 
      // But resize:both can conflict with transform. 
      // A better way is to update top/left and reset transform, or just use transform.
      panel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }
}

// Listener for responses back from inject.js
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === "EVTT_DOWNLOAD_JSON") {
    const { name, data } = event.data.payload;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_evtt.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  if (event.data.type === "EVTT_ALERT") {
    alert(event.data.payload.message);
  }
});


// Listeners from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePanel") {
    togglePanel();
  }
});

// Inicialização
injectPageScript();
injectPanel();

// --- INJEÇÃO NATIVA NAS JANELAS DO ROLL20 ---
function observeRoll20Dialogs() {
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList && node.classList.contains("ui-dialog")) {
            // É uma janela de diálogo do Roll20. Verificar se é Ficha ou Panfleto.
            setTimeout(() => injectCustomUrlInput(node), 500); // Aguarda renderizar o conteúdo interno
          }
        });
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectCustomUrlInput(dialogNode) {
  // Helper to extract ID and type
  function getDialogItemInfo(node) {
    let id = node.getAttribute("data-handoutid") || node.getAttribute("data-characterid");
    if (id) return { id, type: node.getAttribute("data-handoutid") ? "handout" : "character" };

    const handoutEl = node.querySelector("[data-handoutid]") || node.querySelector(".handoutviewer") || node.querySelector(".handouteditor");
    if (handoutEl) return { id: handoutEl.getAttribute("data-handoutid") || handoutEl.className.match(/handouteditor|handoutviewer/) && handoutEl.id, type: "handout" };

    const charEl = node.querySelector("[data-characterid]") || node.querySelector(".character-sheet");
    if (charEl) return { id: charEl.getAttribute("data-characterid"), type: "character" };

    // Try finding any element with data-id or class matching
    const dialogBody = node.querySelector(".dialog");
    if (dialogBody) {
      const classes = dialogBody.className.split(" ");
      for (let c of classes) {
        if (c.startsWith("handout-") || c.startsWith("character-")) {
          const parts = c.split("-");
          return { id: parts[1], type: parts[0] };
        }
      }
    }
    return null;
  }

  const itemInfo = getDialogItemInfo(dialogNode);
  console.log("EVTT: Dialog detected, item info:", itemInfo);

  // Procura pela dropzone de imagem do Roll20
  const dropzones = dialogNode.querySelectorAll(".avatar, .dropzone");
  let targetZone = null;
  
  if (dropzones.length > 0) {
    targetZone = dropzones[0].parentNode;
  } else {
    const fileBtn = dialogNode.querySelector("input[type='file']") || dialogNode.querySelector("button.filepicker");
    if (fileBtn) targetZone = fileBtn.closest("div");
  }
  
  if (!targetZone) return;
  if (targetZone.querySelector(".evtt-native-inject")) return;
  
  const container = document.createElement("div");
  container.className = "evtt-native-inject";
  Object.assign(container.style, {
    marginTop: "10px",
    padding: "10px",
    background: "rgba(233, 30, 99, 0.08)",
    border: "1px dashed #E91E63",
    borderRadius: "5px"
  });
  
  const label = document.createElement("label");
  Object.assign(label.style, {
    fontWeight: "bold",
    fontSize: "12px",
    color: "#E91E63",
    display: "block",
    marginBottom: "5px"
  });
  label.textContent = "Enhanced VTT: URL da Imagem";
  
  const row = document.createElement("div");
  Object.assign(row.style, { display: "flex", gap: "5px" });
  
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "https://...";
  Object.assign(input.style, {
    flex: "1",
    padding: "5px",
    borderRadius: "3px",
    border: "1px solid #ccc",
    color: "#000",
    background: "#fff"
  });
  
  const btn = document.createElement("button");
  btn.textContent = "Aplicar";
  btn.type = "button";
  Object.assign(btn.style, {
    background: "#E91E63",
    color: "white",
    border: "none",
    padding: "5px 10px",
    borderRadius: "3px",
    cursor: "pointer"
  });
  
  row.appendChild(input);
  row.appendChild(btn);
  container.appendChild(label);
  container.appendChild(row);
  
  btn.addEventListener("click", () => {
    const url = input.value.trim();
    if (!url) return;
    
    // Atualiza o DOM do diálogo imediatamente para dar feedback visual
    const avatarDiv = dialogNode.querySelector(".avatar") || dialogNode.querySelector(".dropzone");
    if (avatarDiv) {
      let img = avatarDiv.querySelector("img");
      if (!img) {
        avatarDiv.innerHTML = "";
        img = document.createElement("img");
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        img.style.objectFit = "contain";
        avatarDiv.appendChild(img);
      }
      img.src = url;
    }

    // Se temos o ID, salvamos diretamente via injeção por ID
    if (itemInfo && itemInfo.id) {
      window.postMessage({
        type: "EVTT_UPDATE_IMAGE",
        payload: { id: itemInfo.id, type: itemInfo.type, url: url }
      }, "*");
    } else {
      // Fallback por nome se falhar em pegar ID
      const nameInput = dialogNode.querySelector("input.name");
      if (nameInput) {
        window.postMessage({
          type: "EVTT_UPDATE_IMAGE_BY_NAME",
          payload: { name: nameInput.value, url: url }
        }, "*");
      }
    }
    
    // Feedback visual do botão
    btn.textContent = "Salvo!";
    btn.style.background = "#4CAF50";
    setTimeout(() => {
      btn.textContent = "Aplicar";
      btn.style.background = "#E91E63";
    }, 2000);
  });
  
  targetZone.appendChild(container);
}

// Inicia o observador
observeRoll20Dialogs();
