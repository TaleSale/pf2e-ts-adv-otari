import CONFIGURATION from "./adventure.mjs";

/**
 * @typedef {Object} LocalizationData
 * @property {Set<string>} html       HTML files which provide Journal Entry page translations
 * @property {object} i18n            An object of localization keys and translation strings
 */

/**
 * A subclass of the core AdventureImporter which performs some special functions for Pathfinder premium content.
 */
export default class PF2EAdventureImporter extends AdventureImporter {
  constructor(adventure, options) {
    super(adventure, options);
    this.config = CONFIGURATION.adventure;
    this.options.classes.push(CONFIGURATION.cssClass);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options={}) {
    return foundry.utils.mergeObject(await super.getData(options), {
      importOptions: this.config.importOptions || {}
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderInner(data) {
    const html = await super._renderInner(data);
    if ( !this.config.importOptions ) return html;

    // Insert import controls.
    const imported = game.settings.get(CONFIGURATION.moduleId, "imported");
    if ( imported ) this.#addImportControls(html.find(".adventure-contents")[0]);

    // Insert options and return
    html.find(".adventure-contents").append(this.#formatOptions());
    return html;
  }

  /* -------------------------------------------- */

  /**
   * Format adventure import options block.
   * @returns {string}
   */
  #formatOptions() {
    let options = `<section class="import-form"><h2>Importer Options</h2>`;
    for ( const [name, option] of Object.entries(this.config.importOptions) ) {
      options += `<div class="form-group">
        <label class="checkbox">
            <input type="checkbox" name="${name}" title="${option.label}" ${option.default ? "checked" : ""}/>
            ${option.label}
        </label>
      </div>`;
    }
    options += `</section>`;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Add controls for which content to import.
   * @param {HTMLElement} content  The adventure content container.
   */
  #addImportControls(content) {
    const heading = content.querySelector("h2");
    const list = content.querySelector("ul");
    const section = document.createElement("section");
    section.classList.add("import-controls");
    let html = `
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="importFields" value="all" title="Import All" checked>
          Import All
        </label>
      </div>
    `;
    for (const [field, cls] of Object.entries(Adventure.contentFields)) {
      const count = this.object[field].size;
      if ( !count ) continue;
      const label = game.i18n.localize(count > 1 ? cls.metadata.labelPlural : cls.metadata.label);
      html += `
        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" name="importFields" value="${field}" title="Import ${label}"
                   checked disabled>
            <i class="${CONFIG[cls.documentName].sidebarIcon}"></i>
            ${count} ${label}
          </label>
        </div>
      `;
    }
    section.innerHTML = html;
    section.insertAdjacentElement("afterbegin", heading);
    list.before(section);
    list.remove();
    section.querySelector('[value="all"]').addEventListener("change", event => {
      this.#onToggleImportAll(event);
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the import all checkbox.
   * @param {Event} event  The change event.
   */
  #onToggleImportAll(event) {
    const target = event.currentTarget;
    const section = target.closest(".import-controls");
    const checked = target.checked;
    section.querySelectorAll("input").forEach(input => {
      if ( input.value !== "folders" ) input.disabled = checked;
      if ( checked ) input.checked = true;
    });
    target.disabled = false;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareImportData(formData) {
    this.submitOptions = formData;
    const {toCreate, toUpdate, documentCount} = await super._prepareImportData(formData);
    this.#applyImportControls(formData, toCreate, toUpdate);
    this.#applyEnhancedMapsPreference(formData.enhancedMaps, toCreate, toUpdate);

    // Prepare localization data
    const localization = await this.#prepareLocalizationData();

    // Merge Compendium Actor data
    if ( "Actor" in toCreate ) await this.#mergeCompendiumActors(toCreate.Actor, formData);
    if ( "Actor" in toUpdate ) await this.#mergeCompendiumActors(toUpdate.Actor, formData);

    // Merge Journal HTML data
    if ( "JournalEntry" in toCreate ) await this.#mergeJournalHTML(toCreate.JournalEntry, localization);
    if ( "JournalEntry" in toUpdate ) await this.#mergeJournalHTML(toUpdate.JournalEntry, localization);

    // Apply localized translations
    await this.#applyTranslations(toCreate, localization);
    await this.#applyTranslations(toUpdate, localization);

    return {toCreate, toUpdate, documentCount};
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _importContent(toCreate, toUpdate, documentCount) {
    const importResult = await super._importContent(toCreate, toUpdate, documentCount);
    for ( let [name, option] of Object.entries(this.config.importOptions || {}) ) {
      if ( !option.handler ) continue;
      await option.handler(this.document, option, this.submitOptions[name]);
    }

    return importResult;
  }

  /* -------------------------------------------- */
  /*  Pre-Import Customizations                   */
  /* -------------------------------------------- */

  /**
   * Get available localization data which can be used during the import process
   * @returns {Promise<LocalizationData>}
   */
  async #prepareLocalizationData() {
    const path = `modules/${CONFIGURATION.moduleId}/lang/${game.i18n.lang}/${this.config.slug}`;
    if ( game.i18n.lang === "en" ) return {path, i18n: {}, html: new Set()};
    const json = `${path}/${this.config.slug}.json`;
    try {
      const files = (await FilePicker.browse("data", path)).files;
      const i18n = files.includes(json) ? await fetch(json).then(r => r.json()) : {};
      const html = new Set(files.filter(f => f.endsWith(".html")));
      return {path, i18n, html};
    } catch(err) {
      return {path, i18n: {}, html: new Set()};
    }
  }

  /* -------------------------------------------- */

  /**
   * Merge Actor data with authoritative source data from system compendium packs
   * @param {Actor[]} actors        Actor documents intended to be imported
   * @param {object} importOptions  Form submission import options
   * @returns {Promise<void>}
   */
  async #mergeCompendiumActors(actors, importOptions) {
    for ( const actor of actors ) {
      const sourceId = actor.flags?.core?.sourceId;
      if ( !sourceId ) {
        console.warn(`[${CONFIGURATION.moduleId}] Actor "${actor.name}" [${actor._id}] had no `
          + "sourceId to retrieve source data from.");
        continue;
      }

      const source = await fromUuid(sourceId);
      if ( source ) {
        const {system, items, effects} = source.toObject();
        const updateData = {
          system, items, effects,
          "flags.core.sourceId": source.uuid
        };
        const overrides = this.config.actorOverrides[actor._id] || [];
        for ( const field of overrides ) delete updateData[field];
        foundry.utils.mergeObject(actor, updateData);
      } else {
        const [, scope, packName] = sourceId?.split(".") ?? [];
        console.warn(`[${CONFIGURATION.moduleId}] Compendium source data for "${actor.name}" `
            + `[${actor._id}] not found in pack ${scope}.${packName}.`);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Merge JournalEntry data with localized source HTML.
   * @param {JournalEntry[]} entries                JournalEntry documents intended to be imported
   * @param {LocalizationData} localization         Localization configuration data
   * @returns {Promise<void>}
   */
  async #mergeJournalHTML(entries, localization) {
    for ( const entry of entries ) {
      for ( const page of entry.pages ) {
        const htmlFile = `${localization.path}/${page._id}-${page.name.slugify({strict: true})}.html`;
        if ( localization.html.has(htmlFile) ) {
          const content = await fetch(htmlFile).then(r => r.text()).catch(err => null);
          if ( content ) foundry.utils.mergeObject(page, {"text.content": content});
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply localization translations to documents prior to import.
   * @param {Object<string,Document[]>} group       A group of documents to be created or updated
   * @param {LocalizationData} localization         Localization configuration data
   * @returns {Promise<void>}
   */
  async #applyTranslations(group, localization) {
    for ( const [documentName, documents] of Object.entries(group) ) {
      const translations = localization.i18n[documentName] || [];
      for ( const document of documents ) {
        const translation = translations.find(d => d._id === document._id);
        if ( translation ) foundry.utils.mergeObject(document, translation);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Remove adventure content that the user indicated they did not want to import.
   * @param {object} formData  The submitted adventure form data.
   * @param {object} toCreate  An object of document data to create.
   * @param {object} toUpdate  An object of document data to update.
   */
  #applyImportControls(formData, toCreate, toUpdate) {
    if ( !game.settings.get(CONFIGURATION.moduleId, "imported") ) return;
    const fields = formData.importFields.filter(_ => _);
    fields.push("folders");
    if ( !fields || !Array.isArray(fields) || fields.some(field => field === "all") ) return;
    const keep = new Set(fields.map(field => Adventure.contentFields[field].documentName));
    [toCreate, toUpdate].forEach(docs => {
      for ( const type of Object.keys(docs) ) {
        if ( !keep.has(type) ) delete docs[type];
      }
      if ( docs.Folder ) docs.Folder = docs.Folder.filter(f => keep.has(f.type));
    });
  }

  /* -------------------------------------------- */

  /**
   * Remove scenes from the import depending on whether the user wants only the enhanced maps or
   * only the original ones.
   * @param {boolean} useEnhanced  Whether to import enhanced or original maps.
   * @param {object} toCreate      An object of document data to create.
   * @param {object} toUpdate      An object of document data to update.
   */
  #applyEnhancedMapsPreference(useEnhanced, toCreate, toUpdate) {
    const sceneIds = this.config.importOptions.enhancedMaps.sceneIds;
    const affectedScenes = new Set(sceneIds.original.concat(sceneIds.enhanced));
    const original = new Set(sceneIds.original);
    const enhanced = new Set(sceneIds.enhanced);
    [toCreate, toUpdate].forEach(docs => {
      if ( docs.Scene ) docs.Scene = docs.Scene.filter(s => {
        if ( !affectedScenes.has(s._id) ) return true;
        return (useEnhanced && enhanced.has(s._id)) || (!useEnhanced && original.has(s._id));
      });
    });
  }
}
