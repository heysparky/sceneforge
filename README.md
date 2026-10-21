# SceneForge

Specialized scenes for Foundry VTT v14.

SceneForge adds interactive scene types that sit inside an adjustable panel on the canvas. The first is the **Character Roster**: a pick-your-character screen where players browse pre-made characters, read their dossiers, and claim one to play.

## Features

- **Character Roster scene.** A scrolling grid of character portraits, each with an optional dossier (concept, level, XP, background, quote, and free-form notes).
- **Live claiming.** Players claim and release characters in real time. A claimed character is cloned into a folder you choose and set as that player's character. The player's color is also set to match the character's token ring.
- **GM controls.** Assign characters to players, force-release a claim, lock characters so players can't take them, and reorder or edit the roster.
- **Token placement.** **Begin Session** takes you to the scene you pick and lets you place each claimed character's token with the cursor.
- **Adjustable layout.** Drag the panel edges to resize the scene area. Every client sees the change.

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
2. Pick a **source folder** (where your pre-made characters live) and a **destination folder** (where the player copies go). The two must be different.
3. Select the characters to include.

### Setting up the roster (GM)

- **Edit Roster** lets you reorder, add, or remove characters and change folders.
- The **Dossier** button next to each character sets what players see when they hover over its portrait. Dossiers belong to the scene, so each roster can describe the same character differently.
- **Lock** a character so players can't claim it. It shows as "GM only".
- To resize the scene area, click the toggle in its top-left corner and drag the edge handles.

### Choosing characters (players)

Hover over a portrait to read the dossier, then click **Claim**. The character is yours and shows up as your character in Player Configuration. Click **Release** to give it back.

### Starting play (GM)

Click **Begin Session** and pick the scene to play in. Click to place each claimed character's token. After the last one, SceneForge offers to activate the scene for everyone.

## License

[MIT](LICENSE)
