// add a setting: put a key here, then say what it does in apply.js

window.ConfigSchema = {

  dir: '.config',

  files: [
    {
      name: 'os.conf',
      header: [
        'look of the system',
        'edit, then hit "Add in Data" in the code app to apply',
      ],
      keys: [
        {
          key: 'theme',
          type: 'enum',
          values: ['dark', 'light'],
          fallback: 'dark',
          comment: 'dark or light',
        },
        {
          key: 'wallpaper',
          type: 'enum',
          values: ['Nightforrest.jpg', 'dayforrest.jpg'],
          fallback: 'Nightforrest.jpg',
          comment: 'filename from the Wallpapers folder',
        },
      ],
    },

    {
      name: 'windows.conf',
      header: ['windows and tiling'],
      keys: [
        {
          key: 'layout',
          type: 'enum',
          values: ['normal', 'hyprland', 'niri'],
          fallback: 'normal',
          comment: 'normal is floating, hyprland is dwindle, niri is columns',
        },
      ],
    },

    {
      name: 'input.conf',
      header: ['keyboard'],
      keys: [
        {
          key: 'modifier',
          type: 'enum',
          values: ['ctrl-alt', 'alt', 'super'],
          fallback: 'ctrl-alt',
          comment: 'what triggers keybinds. the launcher stays on tapping alt',
        },
      ],
    },

    {
      name: 'widgets.conf',
      header: ['desktop widgets'],
      keys: [
        { key: 'clock', type: 'bool', fallback: true, comment: 'true or false' },
        { key: 'todo', type: 'bool', fallback: true, comment: 'true or false' },
      ],
    },

    {
      name: 'pets.conf',
      header: ['desktop pets, 6 at most', 'more than 4 crashes the os on purpose'],
      keys: [
        { key: 'fox', type: 'int', min: 0, max: 6, fallback: 1, comment: 'the red one' },
        { key: 'black', type: 'int', min: 0, max: 6, fallback: 0, comment: 'the black one' },
        { key: 'akita', type: 'int', min: 0, max: 6, fallback: 0, comment: 'akita' },
      ],
    },
  ],

  keyDef(fileName, key) {
    const file = this.files.find(f => f.name === fileName);
    if (!file) return null;
    return file.keys.find(k => k.key === key) || null;
  },
};