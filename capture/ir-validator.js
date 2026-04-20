function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateRect(rect, path, errors) {
  if (!isObject(rect)) {
    errors.push(`${path} must be an object`);
    return;
  }
  ['x', 'y', 'width', 'height'].forEach((key) => {
    if (!isFiniteNumber(rect[key])) {
      errors.push(`${path}.${key} must be a finite number`);
    }
  });
}

function validateColor(color, path, errors) {
  if (color == null) return;
  if (!isObject(color)) {
    errors.push(`${path} must be an object or null`);
    return;
  }
  ['r', 'g', 'b', 'a'].forEach((key) => {
    if (!isFiniteNumber(color[key])) {
      errors.push(`${path}.${key} must be a finite number`);
    }
  });
  if (typeof color.css !== 'string') {
    errors.push(`${path}.css must be a string`);
  }
}

function validateCommonStyle(style, path, errors) {
  if (!isObject(style)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateColor(style.backgroundColor, `${path}.backgroundColor`, errors);
  validateColor(style.color, `${path}.color`, errors);

  if (!(typeof style.backgroundImage === 'string' || style.backgroundImage == null)) {
    errors.push(`${path}.backgroundImage must be a string or null`);
  }
  if (!isObject(style.borderRadius)) {
    errors.push(`${path}.borderRadius must be an object`);
  } else {
    ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].forEach((key) => {
      if (!isFiniteNumber(style.borderRadius[key])) {
        errors.push(`${path}.borderRadius.${key} must be a finite number`);
      }
    });
  }
  if (!isObject(style.border)) {
    errors.push(`${path}.border must be an object`);
  } else {
    ['topWidth', 'rightWidth', 'bottomWidth', 'leftWidth'].forEach((key) => {
      if (!isFiniteNumber(style.border[key])) {
        errors.push(`${path}.border.${key} must be a finite number`);
      }
    });
    validateColor(style.border.color, `${path}.border.color`, errors);
    if (typeof style.border.style !== 'string') {
      errors.push(`${path}.border.style must be a string`);
    }
  }

  if (!isFiniteNumber(style.opacity)) errors.push(`${path}.opacity must be a finite number`);
  if (typeof style.boxShadow !== 'string') errors.push(`${path}.boxShadow must be a string`);
  if (typeof style.textAlign !== 'string') errors.push(`${path}.textAlign must be a string`);
  if (typeof style.overflow !== 'string') errors.push(`${path}.overflow must be a string`);
  if (!(typeof style.objectFit === 'string' || style.objectFit == null)) errors.push(`${path}.objectFit must be a string or null`);
  if (typeof style.zIndex !== 'string') errors.push(`${path}.zIndex must be a string`);
}

function validateTextStyle(style, path, errors) {
  if (!isObject(style)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateColor(style.color, `${path}.color`, errors);
  if (typeof style.textAlign !== 'string') errors.push(`${path}.textAlign must be a string`);
  if (typeof style.fontFamily !== 'string') errors.push(`${path}.fontFamily must be a string`);
  if (!isFiniteNumber(style.fontSize)) errors.push(`${path}.fontSize must be a finite number`);
  if (typeof style.fontWeight !== 'string') errors.push(`${path}.fontWeight must be a string`);
  if (typeof style.lineHeight !== 'string') errors.push(`${path}.lineHeight must be a string`);
  if (typeof style.letterSpacing !== 'string') errors.push(`${path}.letterSpacing must be a string`);
}

export function validateMinimalIR(data) {
  const errors = [];

  if (!isObject(data)) {
    return { ok: false, errors: ['IR payload must be an object'] };
  }

  if (typeof data.version !== 'string') errors.push('version must be a string');

  if (!isObject(data.meta)) {
    errors.push('meta must be an object');
  } else {
    if (typeof data.meta.title !== 'string') errors.push('meta.title must be a string');
    if (typeof data.meta.url !== 'string') errors.push('meta.url must be a string');
    if (typeof data.meta.capturedAt !== 'string') errors.push('meta.capturedAt must be a string');
    if (typeof data.meta.selection !== 'string') errors.push('meta.selection must be a string');
    if (typeof data.meta.format !== 'string') errors.push('meta.format must be a string');

    if (!isObject(data.meta.viewport)) {
      errors.push('meta.viewport must be an object');
    } else {
      if (!isFiniteNumber(data.meta.viewport.width)) errors.push('meta.viewport.width must be a finite number');
      if (!isFiniteNumber(data.meta.viewport.height)) errors.push('meta.viewport.height must be a finite number');
    }

    if (!isObject(data.meta.page)) {
      errors.push('meta.page must be an object');
    } else {
      if (!isFiniteNumber(data.meta.page.width)) errors.push('meta.page.width must be a finite number');
      if (!isFiniteNumber(data.meta.page.height)) errors.push('meta.page.height must be a finite number');
    }
  }

  if (!isObject(data.root)) {
    errors.push('root must be an object');
  } else {
    if (typeof data.root.id !== 'string') errors.push('root.id must be a string');
    if (typeof data.root.type !== 'string') errors.push('root.type must be a string');
    if (typeof data.root.name !== 'string') errors.push('root.name must be a string');
    validateRect(data.root.rect, 'root.rect', errors);
  }

  if (!Array.isArray(data.nodes)) {
    errors.push('nodes must be an array');
  } else {
    data.nodes.forEach((node, index) => {
      const path = `nodes[${index}]`;
      if (!isObject(node)) {
        errors.push(`${path} must be an object`);
        return;
      }
      if (typeof node.id !== 'string') errors.push(`${path}.id must be a string`);
      if (typeof node.parentId !== 'string') errors.push(`${path}.parentId must be a string`);
      if (typeof node.type !== 'string') errors.push(`${path}.type must be a string`);
      if (typeof node.name !== 'string') errors.push(`${path}.name must be a string`);
      validateRect(node.rect, `${path}.rect`, errors);

      if (node.type === 'text') {
        if (typeof node.text !== 'string') errors.push(`${path}.text must be a string`);
        if (!Array.isArray(node.rects)) errors.push(`${path}.rects must be an array`);
        else node.rects.forEach((rect, rectIndex) => validateRect(rect, `${path}.rects[${rectIndex}]`, errors));
        validateTextStyle(node.style, `${path}.style`, errors);
      } else {
        if (typeof node.tag !== 'string') errors.push(`${path}.tag must be a string`);
        if (!Array.isArray(node.children)) errors.push(`${path}.children must be an array`);
        validateCommonStyle(node.style, `${path}.style`, errors);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function assertMinimalIR(data) {
  const result = validateMinimalIR(data);
  if (!result.ok) {
    throw new Error(`Invalid html2fig IR: ${result.errors.join('; ')}`);
  }
  return data;
}
