import CONFIG from "./adventure.mjs";

/**
 * Define the structure of adventure data fields which require localization.
 * @type {Object<string|Array<object>>}
 */
const LOCALIZATION_FIELDS = {
  name: "",
  description: "",
  actors: [{
    name: "",
    "token.name": ""
  }],
  folders: [{
    name: ""
  }],
  items: [{
    name: "",
    "system.description.value": ""
  }],
  journal: [{
    name: ""
  }],
  macros: [{
    name: ""
  }],
  playlists: [{
    name: "",
    description: "",
    sounds: [{
      name: "",
      description: ""
    }]
  }],
  scenes: [{
    name: "",
    navName: "",
    notes: [{
      text: ""
    }],
    tokens: [{
      name: ""
    }]
  }]
}

/**
 * Extract the values of all localization fields from the provided adventure data
 * @returns {Array<object>} The localization schema
 */
export async function extractLocalization() {
  const pack = game.packs.get(`${CONFIG.moduleId}.${CONFIG.packName}`);
  await pack.getDocuments();

  for ( const adventure of pack.contents ) {
    const adventureConfig = CONFIG.adventure;
    const path = `modules/${CONFIG.moduleId}/lang/en/${adventureConfig.slug}`;
    await FilePicker.createDirectory("data", path).catch(err => {});

    // Extract localization fields
    const i18n = _extractLocalizedFields(adventure.toObject());
    const lf = _createFile(JSON.stringify(i18n, null, 2), `${adventureConfig.slug}.json`)
    await FilePicker.upload("data", path, lf, {}, {notify: false});

    // Extract HTML
    for ( const entry of adventure.data.journal ) {
      if ( !entry.content.trim() ) continue;
      const hf = _createFile(entry.content, `${entry._id}-${entry.name.slugify({strict: true})}.html`, "text/html");
      await FilePicker.upload("data", path, hf, {}, {notify: false});
    }
  }
}

/**
 * Extract the values of all localization fields from a single document.
 * @param {object} documentData
 * @param {Object<string|Array<object>>} fields
 * @returns {Object<string|Array<object>>}
 */
function _extractLocalizedFields(documentData, fields=LOCALIZATION_FIELDS) {
  const mapping = {};
  for ( const [key, value] of Object.entries(fields) ) {
    if ( value instanceof Array ) {
      const collection = documentData[key];
      const entries = collection.reduce((arr, d) => {
        const inner = _extractLocalizedFields(d, value[0]);
        if ( inner ) arr.push(inner);
        return arr;
      }, []);
      if ( entries.length > 0 ) mapping[key] = entries;
    }
    else if ( documentData[key] ) mapping[key] = documentData[key];
  }
  if ( foundry.utils.isObjectEmpty(mapping) ) return null;
  mapping._id = documentData._id;
  return mapping;
}

/**
 * Create a File object which can be uploaded.
 * @returns {File}
 * @private
 */
function _createFile(content, fileName, dataType) {
  const blob = new Blob([content], {type: dataType});
  return new File([blob], fileName, {type: dataType});
}
