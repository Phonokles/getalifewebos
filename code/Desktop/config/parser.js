// format is "key = value", # starts a comment, blank lines are ignored

window.ConfigParser = (function () {

  const TRUE = ['true', 'yes', 'on', '1'];
  const FALSE = ['false', 'no', 'off', '0'];

  function castValue(def, raw) {
    if (def.type === 'enum') {
      if (!def.values.includes(raw)) {
        return { error: `"${raw}" is not allowed, use: ${def.values.join(', ')}` };
      }
      return { value: raw };
    }

    if (def.type === 'bool') {
      const low = raw.toLowerCase();
      if (TRUE.includes(low)) return { value: true };
      if (FALSE.includes(low)) return { value: false };
      return { error: `"${raw}" is not allowed, use: true or false` };
    }

    if (def.type === 'int') {
      if (!/^-?\d+$/.test(raw)) return { error: `"${raw}" is not a whole number` };
      const n = parseInt(raw, 10);
      if (def.min !== undefined && n < def.min) return { error: `${n} is below ${def.min}` };
      if (def.max !== undefined && n > def.max) return { error: `${n} is above ${def.max}` };
      return { value: n };
    }

    return { error: 'unknown type' };
  }

  function formatValue(def, value) {
    if (def.type === 'bool') return value ? 'true' : 'false';
    return String(value);
  }

  function parse(text, fileName) {
    const values = {};
    const errors = [];
    const lines = String(text || '').split(/\r?\n/);

    lines.forEach((rawLine, i) => {
      const lineNo = i + 1;
      const line = rawLine.split('#')[0].trim();
      if (!line) return;

      const eq = line.indexOf('=');
      if (eq < 0) {
        errors.push({ line: lineNo, msg: `"${line}" is missing a =` });
        return;
      }

      const key = line.slice(0, eq).trim();
      const raw = line.slice(eq + 1).trim();

      const def = window.ConfigSchema.keyDef(fileName, key);
      if (!def) {
        errors.push({ line: lineNo, msg: `this file has no key called "${key}"` });
        return;
      }

      const res = castValue(def, raw);
      if (res.error) {
        errors.push({ line: lineNo, msg: `${key}: ${res.error}` });
        return;
      }

      values[key] = res.value;
    });

    return { values, errors };
  }

  function serialize(fileDef, values) {
    const out = [];

    fileDef.header.forEach(h => out.push('# ' + h));
    out.push('');

    fileDef.keys.forEach(def => {
      const value = values[def.key] !== undefined ? values[def.key] : def.fallback;
      if (def.comment) out.push('# ' + def.comment);
      out.push(`${def.key} = ${formatValue(def, value)}`);
      out.push('');
    });

    return out.join('\n');
  }

  // rewrites one value in place so the user's own comments and order survive
  function updateKey(text, def, value) {
    const lines = String(text || '').split(/\r?\n/);
    const wanted = formatValue(def, value);
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const hash = lines[i].indexOf('#');
      const code = hash < 0 ? lines[i] : lines[i].slice(0, hash);
      const eq = code.indexOf('=');
      if (eq < 0) continue;
      if (code.slice(0, eq).trim() !== def.key) continue;

      const trailing = hash < 0 ? '' : '  ' + lines[i].slice(hash);
      lines[i] = `${def.key} = ${wanted}${trailing}`;
      found = true;
      break;
    }

    if (!found) lines.push(`${def.key} = ${wanted}`);

    return lines.join('\n');
  }

  function accepts(def, value) {
    if (value === undefined || value === null) return false;
    if (def.type === 'bool') return typeof value === 'boolean';
    return !castValue(def, String(value)).error;
  }

  return { parse, serialize, updateKey, formatValue, accepts };

})();