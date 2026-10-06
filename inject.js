const TOKEN_CONFIG_FIELDS = [
  // Identificação visual
  "name",
  "imgsrc",
  "width",
  "height",
  "isdrawing",
  "flipv",
  "fliph",

  // Barras
  "bar1_value",
  "bar1_max",
  "bar1_link",
  "showplayers_bar1",

  "bar2_value",
  "bar2_max",
  "bar2_link",
  "showplayers_bar2",

  "bar3_value",
  "bar3_max",
  "bar3_link",
  "showplayers_bar3",

  // Nome
  "showname",
  "showplayers_name",

  // Auras
  "aura1_radius",
  "aura1_color",
  "aura1_square",
  "showplayers_aura1",

  "aura2_radius",
  "aura2_color",
  "aura2_square",
  "showplayers_aura2",

  // Visão / iluminação
  "light_radius",
  "light_dimradius",
  "light_otherplayers",
  "light_hassight",
  "light_angle",
  "light_losangle",
  "light_multiplier",

  // Darkvision / visão noturna
  "has_night_vision",
  "night_vision_distance",
  "night_vision_tint",
  "night_vision_effect",

  // Bright / low light
  "emits_bright_light",
  "bright_light_distance",
  "emits_low_light",
  "low_light_distance",

  // Status
  "statusmarkers"
];

// inject.js
// Este script roda no escopo da página do Roll20, tendo acesso ao `window.Campaign`

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === "EVTT_REQUEST_DATA") {
    sendCampaignData();
  }
  
  if (event.data.type === "EVTT_UPDATE_IMAGE") {
    handleUpdateImage(event.data.payload);
  }
  
  if (event.data.type === "EVTT_EXPORT_JSON") {
    handleExportJSON(event.data.payload);
  }
  
  if (event.data.type === "EVTT_IMPORT_JSON") {
    handleImportJSON(event.data.payload);
  }
  
  if (event.data.type === "EVTT_UPDATE_TOKEN") {
    handleUpdateToken(event.data.payload);
  }
  
  if (event.data.type === "EVTT_UPDATE_IMAGE_BY_NAME") {
    handleUpdateImageByName(event.data.payload);
  }

  if (event.data.type === "EVTT_REQUEST_CHARACTER_ATTRIBUTES") {
    handleRequestCharacterAttributes(event.data.payload);
  }
});

function handleRequestCharacterAttributes({ id }) {
  if (!window.Campaign) return;
  const char = window.Campaign.characters.get(id);
  if (char) {
    let attrs = [];
    if (char.attribs && char.attribs.models) {
      attrs = char.attribs.models.map(attr => {
        return {
          id: attr.id,
          name: attr.get("name"),
          current: attr.get("current"),
          max: attr.get("max")
        };
      });
    }
    window.postMessage({
      type: "EVTT_CHARACTER_ATTRIBUTES_SYNC",
      payload: { id: char.id, attributes: attrs }
    }, "*");
  }
}

function handleUpdateImageByName({ name, url }) {
  if (!window.Campaign) {
    console.warn("EVTT: Campaign not found");
    return;
  }
  
  console.log("EVTT: Trying to update image for:", name, "->", url);
  
  // Procura em personagens usando .models (array nativo do Backbone)
  let model = null;
  
  if (window.Campaign.characters && window.Campaign.characters.models) {
    model = window.Campaign.characters.models.find(c => c.get("name") === name);
  }
  
  // Se não achou, procura em panfletos
  if (!model && window.Campaign.handouts && window.Campaign.handouts.models) {
    model = window.Campaign.handouts.models.find(h => h.get("name") === name);
  }
  
  if (model) {
    console.log("EVTT: Found model, saving avatar:", model.get("name"));
    model.save({ avatar: url });
    updateActiveView(model.id, url);
    sendCampaignData(); // refresh list
  } else {
    console.warn("EVTT: Model not found for name:", name);
  }
}

function handleUpdateToken({ id, config }) {
  if (!window.Campaign || !window.Campaign.activePage) return;
  if (!config || typeof config !== "object") return;

  const page = window.Campaign.activePage();
  if (!page || !page.thegraphics) return;

  let updated = 0;

  page.thegraphics.models.forEach(token => {
    if (token.get("represents") === id) {
      const updates = {};

      // Image
      if (config.imgsrc !== undefined) {
        updates.imgsrc = config.imgsrc;
      }

      // Grid dimensions (Roll20 default is 70x70)
      // The UI uses grid units, while Roll20 token graphics use pixels.
      if (config.width !== undefined && config.width !== "") {
        const width = parseFloat(config.width);
        if (Number.isFinite(width)) {
          updates.width = width * 70;
        }
      }

      if (config.height !== undefined && config.height !== "") {
        const height = parseFloat(config.height);
        if (Number.isFinite(height)) {
          updates.height = height * 70;
        }
      }

      // Copy every supported token configuration field.
      // Empty strings and false/zero values are intentionally preserved.
      TOKEN_CONFIG_FIELDS.forEach(field => {
        if (
          field === "imgsrc" ||
          field === "width" ||
          field === "height"
        ) {
          return;
        }

        if (config[field] !== undefined) {
          updates[field] = config[field];
        }
      });

      // The UI stores aura shape as "round"/"square", while Roll20
      // stores it as a boolean in auraX_square.
      if (config.aura1_shape !== undefined) {
        updates.aura1_square = (config.aura1_shape === "square");
      }

      if (config.aura2_shape !== undefined) {
        updates.aura2_square = (config.aura2_shape === "square");
      }

      // Keep the existing convenience behavior of automatically enabling
      // bars/auras when their values are explicitly configured.
      if (
        config.aura1_radius !== undefined &&
        String(config.aura1_radius).trim() !== ""
      ) {
        updates.showplayers_aura1 = true;
      }

      if (
        config.aura2_radius !== undefined &&
        String(config.aura2_radius).trim() !== ""
      ) {
        updates.showplayers_aura2 = true;
      }

      if (
        config.bar1_value !== undefined ||
        config.bar1_max !== undefined ||
        config.bar1_link !== undefined
      ) {
        updates.showplayers_bar1 = true;
      }

      if (
        config.bar2_value !== undefined ||
        config.bar2_max !== undefined ||
        config.bar2_link !== undefined
      ) {
        updates.showplayers_bar2 = true;
      }

      if (
        config.bar3_value !== undefined ||
        config.bar3_max !== undefined ||
        config.bar3_link !== undefined
      ) {
        updates.showplayers_bar3 = true;
      }

      token.save(updates);
      updated++;
    }
  });

  window.postMessage({
    type: "EVTT_ALERT",
    payload: { message: \`Atualizados \${updated} tokens no mapa atual.\` }
  }, "*");
}

function getModelByIdAndType(id, type) {
  if (!window.Campaign) return null;
  const collection = type === "character" ? window.Campaign.characters : window.Campaign.handouts;
  return collection ? collection.get(id) : null;
}

function handleUpdateImage({ id, type, url }) {
  const model = getModelByIdAndType(id, type);
  if (model) {
    model.save({ avatar: url });
    updateActiveView(id, url);
    sendCampaignData(); // refresh
  }
}

function updateActiveView(id, url) {
  if (!window.jQuery) return;
  window.jQuery(".ui-dialog").each(function() {
    const $dialog = window.jQuery(this);
    // Find the Backbone view associated with the dialog
    const view = $dialog.find(".dialog").data("view") 
              || $dialog.find(".handouteditor").data("view") 
              || $dialog.find(".character-sheet").data("view")
              || $dialog.find(".character").data("view");
              
    if (view && view.model && view.model.id === id) {
      console.log("EVTT: Found active Backbone view, updating avatar reference to:", url);
      view.model.set("avatar", url);
      if (view.avatar !== undefined) view.avatar = url;
      // Force render or update DOM inside the dialog if needed
      const avatarDiv = $dialog.find(".avatar, .dropzone");
      if (avatarDiv.length > 0) {
        let img = avatarDiv.find("img");
        if (img.length === 0) {
          avatarDiv.html("");
          img = window.jQuery("<img style='max-width:100%; max-height:100%; object-fit:contain;' />");
          avatarDiv.append(img);
        }
        img.attr("src", url);
      }
    }
  });
}

async function handleExportJSON({ id, type }) {
  const model = getModelByIdAndType(id, type);
  if (!model) return;

  try {
    console.log("EVTT: Exportando:", model.get("name"));

    // Force-load all data from server before exporting
    await new Promise(r => model.fetch({ success: r, error: r }));

    if (type === "character") {
      if (model.attribs)   await new Promise(r => model.attribs.fetch({ success: r, error: r }));
      if (model.abilities) await new Promise(r => model.abilities.fetch({ success: r, error: r }));
    }

    // Build export object
    const exportData = {
      _exportVersion: 5,
      _exportedAt: new Date().toISOString(),
      character: {}
    };

    // Copy model properties (skip numeric keys and internal IDs)
    Object.keys(model.attributes).forEach(key => {
      if (!/^\d+$/.test(key) && key !== "id" && key !== "_id") {
        exportData.character[key] = model.attributes[key];
      }
    });

    // Default token
 let rawToken =
  (model._blobcache && model._blobcache.defaulttoken) ||
  model.get("defaulttoken");

if (rawToken) {
  let tokenObj = rawToken;

  if (typeof rawToken === "string") {
    try {
      tokenObj = JSON.parse(rawToken);
    } catch (error) {
      console.warn("[EnhancedVTT] Não foi possível interpretar defaulttoken:", error);
      tokenObj = null;
    }
  }

  if (tokenObj && typeof tokenObj === "object") {
    const cleanToken = sanitizeTokenForExport(tokenObj);

    if (cleanToken) {
      exportData.defaulttoken = cleanToken;
    }
  }
}

    // Attributes
    if (type === "character" && model.attribs && model.attribs.models) {
      exportData.attributes = model.attribs.models.map(attr => ({
        id:      attr.id || attr.get("id"),
        name:    attr.get("name"),
        current: attr.get("current") ?? "",
        max:     attr.get("max") ?? ""
      }));
    } else {
      exportData.attributes = [];
    }

    // Abilities
    if (type === "character" && model.abilities && model.abilities.models) {
      exportData.abilities = model.abilities.models.map(ab => ({
        id:            ab.id || ab.get("id"),
        name:          ab.get("name"),
        action:        ab.get("action") ?? "",
        istokenaction: ab.get("istokenaction") ?? false
      }));
    } else {
      exportData.abilities = [];
    }

    console.log("EVTT: Export pronto —", exportData.attributes.length, "atributos,", exportData.abilities.length, "habilidades");

    window.postMessage({
      type: "EVTT_DOWNLOAD_JSON",
      payload: { name: model.get("name") || "Ficha", data: exportData }
    }, "*");

  } catch (err) {
    console.error("EVTT: Erro ao exportar:", err);
    window.postMessage({ type: "EVTT_ALERT", payload: { message: "Erro ao exportar dados da ficha." } }, "*");
  }
}

async function handleImportJSON({ id, type, data }) {
  const model = getModelByIdAndType(id, type);
  if (!model || !data) return;

  try {
    console.log("EVTT: Importando dados para:", model.get("name"));

    // Support both formats: wrapped in "character" key or flat
    const c = data.character || data;

    // Set base character properties
    model.set({
      name:     String(c.name ?? model.get("name") ?? ""),
      bio:      String(c.bio ?? ""),
      gmnotes:  String(c.gmnotes ?? ""),
      avatar:   String(c.avatar ?? ""),
      archived: false
    });

    const attributeIdMap = {};


    // ---- ATTRIBUTES ----
    const importAttributes = data.attributes || data.attribs;
    if (type === "character" && Array.isArray(importAttributes) && model.attribs) {
      // Fetch current attributes first
      await new Promise(r => model.attribs.fetch({ success: r, error: r }));

      // Build lookup of existing attributes by name
      const existing = {};
      model.attribs.models.forEach(a => {
        const name = a.get("name");
        if (name) existing[name] = a;
      });

      // Keep track of which attributes from Roll20 are still in the imported JSON
      const importedNames = new Set();

      // Apply all attributes.
      // Existing attributes can be mapped immediately. New attributes must
      // finish their server-side creation before their real Roll20 ID can
      // be placed in attributeIdMap.
      for (const attr of importAttributes) {
        if (!attr.name) continue;
        importedNames.add(attr.name);

        const currentVal =
          attr.current !== undefined && attr.current !== null
            ? String(attr.current)
            : "";

        const maxVal =
          attr.max !== undefined && attr.max !== null
            ? String(attr.max)
            : "";

        if (existing[attr.name]) {
          const existingAttr = existing[attr.name];

          await new Promise((resolve, reject) => {
            existingAttr.save(
              {
                current: currentVal,
                max: maxVal
              },
              {
                success: resolve,
                error: (_model, error) => reject(error)
              }
            );
          });

          if (attr.id) {
            attributeIdMap[attr.id] =
              existingAttr.id || existingAttr.get("id");
          }
        } else {
          const newAttr = await new Promise((resolve, reject) => {
            const created = model.attribs.create(
              {
                name: String(attr.name),
                current: currentVal,
                max: maxVal
              },
              {
                wait: true,
                success: resolve,
                error: (_model, error) => reject(error)
              }
            );

            if (!created) {
              resolve(null);
            }
          });

          if (attr.id && newAttr) {
            const newAttrId =
              newAttr.id || newAttr.get("id");

            if (newAttrId) {
              attributeIdMap[attr.id] = newAttrId;
            }
          }
        }
      }

      // Destroy attributes that are NOT in the imported JSON
      model.attribs.models.slice().forEach(attr => {
        const name = attr.get("name");
        if (name && !importedNames.has(name)) {
          attr.destroy();
        }
      });
    }

    // ---- ABILITIES ----
    const importAbilities = data.abilities;
    if (type === "character" && Array.isArray(importAbilities) && model.abilities) {
      await new Promise(r => model.abilities.fetch({ success: r, error: r }));

      // Build lookup of existing abilities by name
      const existingAbilities = {};
      model.abilities.models.forEach(a => {
        const name = a.get("name");
        if (name) existingAbilities[name] = a;
      });

      const importedAbilityNames = new Set();

      // Create or update abilities
      for (const ab of importAbilities) {
        if (!ab.name) continue;
        importedAbilityNames.add(ab.name);

        const actionVal = String(ab.action ?? "");
        const isTokenActionVal = !!ab.istokenaction;

        if (existingAbilities[ab.name]) {
          const extAb = existingAbilities[ab.name];
          if (String(extAb.get("action") ?? "") !== actionVal || !!extAb.get("istokenaction") !== isTokenActionVal) {
            extAb.save({
              action:        actionVal,
              istokenaction: isTokenActionVal
            });
          }
        } else {
          model.abilities.create({
            name:          String(ab.name),
            action:        actionVal,
            istokenaction: isTokenActionVal
          });
        }
      }

      // Destroy abilities that are NOT in the imported JSON
      model.abilities.models.slice().forEach(ab => {
        const name = ab.get("name");
        if (name && !importedAbilityNames.has(name)) {
          ab.destroy();
        }
      });
    }

    // ---- DEFAULT TOKEN ----
    let importedToken = null;

    if (type === "character" && data.defaulttoken) {
      let token = data.defaulttoken;

      if (typeof token === "string") {
        try {
          token = JSON.parse(token);
        } catch (error) {
          console.warn(
            "[EnhancedVTT] Não foi possível interpretar o defaulttoken importado:",
            error
          );
          token = null;
        }
      }

      if (token && typeof token === "object") {
        importedToken = prepareTokenForImport(
          token,
          model.id,
          attributeIdMap
        );

        if (importedToken) {
          const tokenStr = JSON.stringify(importedToken);

          model.set("defaulttoken", tokenStr);

          model._blobcache = model._blobcache || {};
          model._blobcache.defaulttoken = tokenStr;
        }
      }
    }

    // Final save for the character and its default token.
    await model.save();

    // The defaulttoken is the portable source of truth for token
    // configuration. Existing tokens on the active page receive those
    // configuration values while keeping their own map placement.
    let updatedMapTokens = 0;

    if (importedToken) {
      updatedMapTokens = applyImportedTokenConfigToExistingTokens(
        model.id,
        importedToken
      );
    }

    window.postMessage({
      type: "EVTT_ALERT",
      payload: {
        message:
          updatedMapTokens > 0
            ? \`Ficha importada com sucesso! \${updatedMapTokens} token(s) do mapa atualizados.\`
            : "Ficha importada com sucesso!"
      }
    }, "*");
    sendCampaignData();

  } catch (err) {
    console.error("EVTT: Erro ao importar:", err);
    window.postMessage({ type: "EVTT_ALERT", payload: { message: "Erro ao importar dados da ficha." } }, "*");
  }
}

function remapTokenAttributeLinks(token, attributeIdMap) {
  if (!token || typeof token !== "object") {
    return token;
  }

  const bars = [
    "bar1_link",
    "bar2_link",
    "bar3_link"
  ];

  bars.forEach(bar => {
    if (token[bar] === undefined) {
      return;
    }

    const oldId = token[bar];

    if (!oldId) {
      token[bar] = "";
      return;
    }

    token[bar] = attributeIdMap[oldId] || oldId;
  });

  return token;
}

function applyImportedTokenConfigToExistingTokens(characterId, tokenConfig) {
  if (!window.Campaign || !window.Campaign.activePage) {
    return 0;
  }

  if (!characterId || !tokenConfig || typeof tokenConfig !== "object") {
    return 0;
  }

  const page = window.Campaign.activePage();
  if (!page || !page.thegraphics || !page.thegraphics.models) {
    return 0;
  }

  let updated = 0;

  page.thegraphics.models.forEach(token => {
    if (token.get("represents") !== characterId) {
      return;
    }

    const updates = {};

    // Apply only portable configuration fields.
    // Position, rotation, layer and Roll20 object IDs are intentionally
    // excluded from TOKEN_CONFIG_FIELDS, so existing map placement survives.
    TOKEN_CONFIG_FIELDS.forEach(field => {
      if (tokenConfig[field] !== undefined) {
        updates[field] = tokenConfig[field];
      }
    });

    if (Object.keys(updates).length > 0) {
      token.save(updates);
      updated++;
    }
  });

  return updated;
}

function prepareTokenForImport(tokenData, characterId, attributeIdMap) {
  if (!tokenData || typeof tokenData !== "object") {
    return null;
  }

  const token = JSON.parse(JSON.stringify(tokenData));

  // IDs específicos da campanha antiga nunca devem ser reutilizados
  delete token._id;
  delete token._pageid;
  delete token.id;

  // Token-instance fields must never be copied into an existing map token.
  // The exported whitelist normally prevents these fields from appearing,
  // but removing them here also protects imports of older/manual JSON files.
  delete token.left;
  delete token.top;
  delete token.rotation;
  delete token.layer;

  // O token deve representar o personagem de destino
  token.represents = characterId;

  // Corrigir links das barras
  remapTokenAttributeLinks(token, attributeIdMap);

  return token;
}

function extractTokenConfig(token) {
  if (!token) return null;

  const config = {};

  TOKEN_CONFIG_FIELDS.forEach(field => {
    const value = token.get(field);

    if (value !== undefined) {
      config[field] = value;
    }
  });

  return config;
}

function sanitizeTokenForExport(tokenData) {
  if (!tokenData || typeof tokenData !== "object") {
    return null;
  }

  const clean = {};

  TOKEN_CONFIG_FIELDS.forEach(field => {
    if (tokenData[field] !== undefined) {
      clean[field] = tokenData[field];
    }
  });

  return clean;
}

function getAccessibleItems(collection, itemType) {
  if (!window.Campaign || !window.currentPlayer) return [];
  
  const playerId = window.currentPlayer.id;
  const isGM = window.is_gm; // flag do Roll20
  
  return collection.models.filter(model => {
    if (isGM) return true; // GM vê tudo
    
    const controlledBy = model.get("controlledby") || "";
    return controlledBy.includes(playerId) || controlledBy.includes("all");
  }).map(model => {
    let attributes = [];
    
    if (itemType === "character" && model.attribs && model.attribs.models) {
      attributes = model.attribs.models.map(attr => {
        return {
          id: attr.id,
          name: attr.get("name"),
          current: attr.get("current"),
          max: attr.get("max")
        };
      });
    }
    
    return {
      id: model.id,
      name: model.get("name"),
      avatar: model.get("avatar") || "", // Imagem
      type: itemType,
      attributes: attributes
    };
  });
}

function sendCampaignData() {
  if (!window.Campaign) {
    console.warn("Enhanced VTT: window.Campaign não encontrado. A página ainda está carregando?");
    return;
  }
  
  const characters = getAccessibleItems(window.Campaign.characters, "character");
  const handouts = getAccessibleItems(window.Campaign.handouts, "handout");
  
  window.postMessage({
    type: "EVTT_DATA_SYNC",
    payload: {
      characters,
      handouts
    }
  }, "*");
}
