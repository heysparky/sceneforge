# SceneForge

Specialized scenes for Foundry VTT v14.

SceneForge adds interactive scene types that sit inside an adjustable panel on the canvas. The first is the **Character Roster**: a pick-your-character screen where players look over pre-made characters and choose one to play.

## Features

- **Character Roster scene.** A grid of character portraits that sizes itself to the roster. Select a character to see its art and details from its character sheet: class or concept, XP, biography, and (for Roll for Shoes) skills, inventory and statuses.
- **Always matches the sheet.** The roster reads straight from each character's actor, so editing a sheet updates the roster live. There's nothing to keep in sync.
- **Live claiming.** Players choose and give back characters in real time. A claimed character is cloned into a folder you choose and set as that player's character, and the player's color changes to the character's token ring color.
- **Party bar.** Shows every player at a glance: who has chosen whom, who is still choosing, and who has stepped away.
- **GM controls.** Assign a character to a player in one click, release a player's choice, lock characters in a roster so players can't take them, and reorder or edit the roster.
- **Token placement.** **Begin Session** takes you to the scene you pick and lets you place each claimed character's token with the cursor.
- **Looks.** Four built-in looks (Plain, Ledger, File, Night), chosen per roster. You can add your own with CSS (see [Theming](#theming)).
- **Adjustable layout.** A new roster opens as a centered panel big enough for six characters. Drag the panel edges to resize it; every client sees the change.

## Installation

<!-- TODO (release): this URL 404s until the first GitHub Release exists. Once 0.1.0 is cut, confirm it installs. -->
In Foundry, go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/heysparky/sceneforge/releases/latest/download/module.json
```

Then enable **SceneForge** in your world's Module Management.

Requires Foundry VTT v14. No other modules needed.

## Usage

### Creating a roster (GM)

1. In the Scenes sidebar, click **Create Scene** and choose **Roster**.
2. Choose where the characters come from (a folder, or all actors) and where player copies go. The two must be different.
3. Pick the characters to include.

### Setting up the roster (GM)

- **Edit Roster** (top right of the roster) lets you drag characters into order, add or remove them, change folders, and pick the roster's look.
- Character details come from the character sheets. To change what players read, edit the sheet. To choose which details show at all, open **Configure Settings → SceneForge**. You can turn each section on or off there, and tell SceneForge where your system keeps a character's class.
- **Lock** a character, from its panel, so players can't choose it in this roster. Locks belong to the roster, so the same character can be open in another one.
- To resize the scene area, click the move icon in its bottom-right corner and drag the edge handles.

### Choosing characters (players)

Click a portrait to read about that character, or double-click it to open the full character sheet. Click **Play *name*** to take it. It becomes your character in Player Configuration. Changed your mind? Click **Changed my mind** to give it back.

### Starting play (GM)

Once everyone online has a character, click **Begin Session** and pick the scene to play in. Click to place each claimed character's token. After the last one, SceneForge offers to activate the scene for everyone.

## Theming

Every color, font and size on the roster comes from CSS variables on `.sf-roster`. To add your own look, define a block in a world stylesheet or a CSS module:

```css
.sf-roster[data-sf-theme="default"] {
  --sf-bg: #101418;
  --sf-surface: #182027;
  --sf-ink: #e8eef2;
  --sf-ink-muted: #8b98a3;
  --sf-rule: rgba(232, 238, 242, 0.12);
  --sf-accent: #e0b354;
  --sf-on-accent: #16120a;
  --sf-font-display: "Modesto Condensed", serif;
  --sf-font-body: "Signika", sans-serif;
  --sf-radius: 2px;
}
```

This example overrides the Plain look. To change another look, use its key (`ledger`, `file` or `night`) instead of `default`.

## License

[MIT](LICENSE)
