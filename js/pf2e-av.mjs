import CONFIG from "./adventure.mjs";
import PF2EAdventureImporter from "./importer.mjs";
import {extractLocalization} from "./i18n.mjs";

/* -------------------------------------------- */
/*  Initialize Module API 		                  */
/* -------------------------------------------- */

Hooks.once("init", () => {
  const module = game.modules.get(CONFIG.moduleId);
  module.api = {
    PF2EAdventureImporter,
    extractLocalization
  };

  // Register settings
  game.settings.register(CONFIG.moduleId, "startup", {
    name: "One-Time Startup Prompt",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Register sheets
  DocumentSheetConfig.registerSheet(Adventure, CONFIG.moduleId, PF2EAdventureImporter, {
    label: "Abomination Vaults Importer"
  });
})

/* -------------------------------------------- */
/*  Activate Module Features                    */
/* -------------------------------------------- */

Hooks.on("ready", async (app, html, data) => {
  // Imported state.
  game.settings.register(CONFIG.moduleId, "imported", {
    scope: "world",
    type: Boolean,
    config: false,
    default: game.journal.has(CONFIG.adventure.gettingStartedId)
  });

  const module = game.modules.get(CONFIG.moduleId);
  const firstStartup = game.settings.get(CONFIG.moduleId, "startup") === false;
  if ( firstStartup ) {
    for ( const p of module.packs ) {
      const pack = game.packs.get(`${CONFIG.moduleId}.${p.name}`);
      const adventures = await pack.getDocuments();
      for ( const adventure of adventures ) {
        adventure.sheet.render(true);
      }
    }
    game.settings.set(CONFIG.moduleId, "startup", true);
  }
});

Hooks.on("importAdventure", () => game.settings.set(CONFIG.moduleId, "imported", true));

/* -------------------------------------------- */
/*  Journal Styling						        */
/* -------------------------------------------- */

Hooks.on("renderJournalSheet", (app, html, data) => {
  const journal = app.document;
  if ( journal.getFlag(CONFIG.moduleId, CONFIG.journalFlag) ) html[0].classList.add(CONFIG.cssClass);
});

Hooks.on("renderJournalPageSheet", (app, html, data) => {
  const journal = app.document.parent;
  if ( journal.getFlag(CONFIG.moduleId, CONFIG.journalFlag) ) html[0].classList.add(CONFIG.cssClass);
});
