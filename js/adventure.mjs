
/**
 * Override which attributes of an Actor should be kept from the exported adventure data rather than imported from
 * the source compendium.
 */
const ACTOR_IMPORT_OVERRIDES = {
  "oSQ3Q9tzTohksAtf": ["system"], 		    // Crawling Hand          (elite)
  "QnbMaJPU7jG4uhaC": ["system"], 	    	// Soul Feeder            (elite)
  "GsrqCDf0Dc9PisEt": ["system"], 		    // Violet Fungus          (weak)
  "RFCxaIS4OkacCpxD": ["system"], 		    // Bog-rotted Froghemoth  (weak)
  "pFPLCspUfJ2FUMcj": ["system"],	        // Falxi Orshendiel
  "GoGNtiHuYycppLPk": ["system"], 		    // Cynemi
  "u36SRb3lyB4beHCN": ["system"], 		    // Lasda Venkervale
  "HBRz8BVLVN9u9Odp": ["items"] 		      // Corpselight
}

// Abomination Vaults
const ABOMINATION_VAULTS = {
  slug: "abomination-vaults",
  title: "Abomination Vaults",
  actorOverrides: ACTOR_IMPORT_OVERRIDES,
  importOptions: {
    enhancedMaps: {
      label: "Use Enhanced Maps",
      default: true,
      sceneIds: {
        original: ['MSHO9s465zhZIuH7', '2dHU2g8WUOc4NZlq', 'TE8aNKdE5NKGSgoV', 'l9piQKpfF80Tf4Ee', 'D3ZsHuxFbD9XJ8xm', 'C1FHtLrwQGvYvHEj', 'xlVpxXlwLDBkigNr', 'jZ6KNRkZJbhIFTUH', 'k9jeCoWPx2z9Q3WU', '6JuLFPWO21xzKgbc', 'RYdmLnFJOm9YjMjc', '5yFFxnSZdYE1NWYM', 'sY80sj7X5MD0mH2A'],
        enhanced: ['MSHO9s465zhZIuH7', 'lQkXSdxvO9CRxohD', '9hB3ZY7buScJPXEy', '3Nat4ImT49niZUdr', 'BDb75TAOyhTzNzte', 'N4Gsv8cBg1oK6EGS', 'Y4pI9rvbaVvmK2kn', 'B9O44gBwHIUTRasQ', '2bM6K9jKWHJoYURa', 'lKRTHUBDXYzwd80e', 'MrRFPOICNcpBbfca', 'Z5ExlCWEpqm0SMe1', 'kxMIly2TCSidrRf1', 'SkPDNmMoL4M4r1it', 'o3zbh5CXtTQiWKwZ', '3Z2uyLiembwA6fft', 'pRvx3DZRnH50eV6d']
      },
      handler (adventure, option, enabled) {
        const sceneIds = option.sceneIds;
        const original = new Set(sceneIds.original);
        const enhanced = new Set(sceneIds.enhanced);
        const updates = sceneIds.original.concat(sceneIds.enhanced).reduce((acc, id) => {
          if ( game.scenes.has(id) ) acc.push({
            _id: id,
            navigation: (enabled && enhanced.has(id)) || (!enabled && original.has(id))
          });
          return acc;
        }, []);
        return Scene.implementation.updateDocuments(updates);
      }
    },
    activateScene: {
      label: "Activate Initial Scene",
      default: true,
      handler: (adventure, option, enabled) => {
        if ( !enabled ) return;
        return game.scenes.get(option.sceneId)?.activate();
      },
      sceneId: "MSHO9s465zhZIuH7"
    },
    displayJournal: {
      label: "Display Introduction Journal Entry",
      default: true,
      handler: (adventure, option, enabled) => {
        if ( !enabled ) return;
        return game.journal.get(option.entryId)?.sheet.render(true);
      },
      entryId: "3iU3rV1nbiW2OYXM"
    },
    customizeJoin: {
      label: "Customize World Details",
      default: false,
      background: "modules/pf2e-ts-adv-abomination-vaults/assets/journal-images/vignettes/av-cover.webp",
      handler: async (adventure, option, enabled) => {
        if ( !enabled ) return;
        const module = game.modules.get("pf2e-ts-adv-abomination-vaults");
        const worldData = {
          action: "editWorld",
          id: game.world.id,
          description: module.description,
          background: option.background
        }
        await fetchJsonWithTimeout(foundry.utils.getRoute("setup"), {
          method: "POST",
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(worldData)
        });
        game.world.data.update(worldData);
      }
    }
  },

  // The ID of the 'Getting Started' journal to determine if the adventure has been imported before.
  gettingStartedId: "3iU3rV1nbiW2OYXM"
};

export default {
  moduleId: "pf2e-ts-adv-abomination-vaults",
  packName: "av",
  journalFlag: "isAV",
  cssClass: "pf2e-av",
  adventure: ABOMINATION_VAULTS,
  languages: ["ru"]
}
