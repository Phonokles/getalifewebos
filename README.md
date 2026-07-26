# getalifewebos

(it's a lie programmers can't have a life)

A desktop operating system that runs in your browser. Window manager, workspaces, a terminal, a
virtual filesystem and a bunch of apps, all in plain HTML, CSS and JavaScript. No frameworks, no
build step, no dependencies.

Live at [getalifeweboslol.vercel.app](https://getalifeweboslol.vercel.app)

Built for the Stardance challenge. The idea was a clean user experience that is still fun to poke at.

## What it does

**Window manager with three layout modes.** Normal is regular floating windows you can drag and
resize. Hyprland does dwindle tiling, where every new window splits the focused one. Niri gives you
scrollable columns. Switch modes in Settings, in the terminal, or with a keybind. Windows snap to
screen edges, go fullscreen, and open several instances of the same app at once.

**Four workspaces**, switchable from the top bar or the keyboard, and you can throw a window from
one to another.

**A virtual filesystem** that lives in RAM. Create folders and files, browse them in the Files app,
or work on them from the terminal with `ls`, `cd`, `cat`, `mkdir`, `nano` and friends. Text files
open in the code editor, images open in the viewer.

**Config files.** The system writes its settings into `.config` as plain text. Edit
`os.conf` in the code editor, hit save, and the theme or wallpaper changes right away. Change
something in Settings instead and the file updates itself. Both directions stay in sync.

**A launcher.** Tap Alt and start typing. Fuzzy search across every app and a few system actions
like switching theme or layout.

**Desktop pets** that wander along the taskbar, widgets for clock and todos, a lock screen, boot
and shutdown animations, notifications, and break and drink reminders.

There is also a crashout easter egg. You will find it.

## Apps

| | |
|---|---|
| terminal | about 30 commands, its own filesystem, `nano` for editing |
| files | browse the virtual filesystem |
| code | text editor, saves to the filesystem or downloads |
| paint | draw on a canvas, save into the filesystem or download |
| viewer | look at wallpapers and anything you drew, set any of them as background |
| monitor | btop style, real load and fps graphs, memory, filesystem stats, open windows |
| calculator | a calculator |
| todo | tasks that survive a reload |
| snake | snake |
| settings | wallpapers, theme, pets, widgets, layout, keybinds |

## Keybinds

The trigger key is Ctrl + Alt by default, and you can change it to Alt or Super in Settings.
On a German keyboard only the left Alt key triggers, so AltGr stays free for `@ { } [ ] |`.

| | |
|---|---|
| tap Alt | launcher |
| mod + 1 to 4 | switch workspace |
| mod + shift + 1 to 4 | move window to workspace |
| mod + enter | terminal |
| mod + e | files |
| mod + c | code |
| mod + q | close window |
| mod + f | fullscreen |
| mod + h / l | focus previous or next window |
| mod + w | cycle layout mode |
| mod + o | overview |
| mod + x | lock screen |
| mod + k | show all keybinds |

## Config files

Living in `.config` inside the virtual filesystem:

| | |
|---|---|
| os.conf | theme, wallpaper |
| windows.conf | layout mode |
| input.conf | which key triggers keybinds |
| widgets.conf | clock and todo visibility |
| pets.conf | how many of each pet |

The format is `key = value`, `#` starts a comment. Invalid values are rejected with the line number
instead of being applied, so you cannot break anything by typing nonsense.

Since the filesystem only lives in RAM, these files are rebuilt on every start from the real state.
The values themselves survive because they are stored the same way the Settings app stores them.

## Structure

```
code/
├── index.html            redirects to the welcome page
├── welcomepage/
├── bootanim/  shutdownanim/  lock/
├── Wallpapers/  assets/
└── Desktop/
    ├── Desktop.html      the actual OS, loads everything below
    ├── themes.css        the four colour variables
    ├── windows/          window manager, tiling, snapping
    ├── taskbar/  topbar/  Overview/
    ├── widgets/          clock, todo, widget manager
    ├── popups/           notifications, drink reminder
    ├── breakreminder/  crashout/
    ├── keybinds/         keybind registry, cheatsheet, iframe forwarding
    ├── launcher/         the Alt-tap launcher
    ├── config/           schema, parser, apply, wiring
    └── applications/     one folder per app
```

Every app runs in its own iframe and talks to the desktop through `postMessage`. Theme and wallpaper
changes get pushed down to the apps the same way.

## Running it locally

No build step. Clone it and serve the folder:

```
python -m http.server 8000
```

Then open `http://localhost:8000/code/Desktop/Desktop.html`. VS Code with Live Server works too.

Opening the files directly with `file://` does not work, because browsers block localStorage there
and the OS needs it to remember your settings.

## If the welcome page gets stuck

If your browser scales websites too much you can get stuck on the welcome page. Scale it down with
Ctrl and minus, then the "Lets go" button is reachable again.

## Credits

SVG icons for the taskbar and settings were written by Claude.

Pets come from [vscode-pets](https://tonybaloney.github.io/vscode-pets). Worth installing in VS Code,
it is very nice.

Wallpapers from [Pinterest](https://de.pinterest.com/pin/pixel-art-night-forest-by-corykeks--86835099413458407/)
and [Adobe Stock](https://stock.adobe.com/de/search?k=pixel+forest&asset_id=919771631).
