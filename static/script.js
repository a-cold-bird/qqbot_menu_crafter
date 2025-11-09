// Global state
let currentConfig = null;
let availableFonts = ['default'];
let presetThemes = {};
let autoPreviewEnabled = true;
let previewTimeout = null;

// Note: Partial rendering cache removed - using instant HTML rendering now
let lastRenderedConfig = null;

// Color conversion utilities
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function parseColorInput(input) {
    // Remove spaces
    input = input.trim();

    // Check if it's hex format
    if (input.startsWith('#')) {
        return input;
    }

    // Check if it's rgb format: rgb(r, g, b) or r, g, b or r,g,b
    const rgbMatch = input.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
        return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
    }

    // Simple format: "255, 0, 0" or "255,0,0"
    const simpleMatch = input.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (simpleMatch) {
        return rgbToHex(parseInt(simpleMatch[1]), parseInt(simpleMatch[2]), parseInt(simpleMatch[3]));
    }

    // If it already looks like hex without #, add it
    if (/^[0-9A-Fa-f]{6}$/.test(input)) {
        return '#' + input;
    }

    return null;
}

function formatColorAsHex(hex) {
    // Ensure the color is in uppercase hex format
    if (!hex) return '#000000';
    return hex.toUpperCase();
}

// Debounce function
function debounce(func, delay) {
    return function(...args) {
        if (previewTimeout) {
            clearTimeout(previewTimeout);
        }
        previewTimeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Auto preview with debounce
const autoPreview = debounce(function() {
    if (autoPreviewEnabled && currentConfig) {
        previewImage();
    }
}, 800);  // 800ms delay

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadConfig();
    loadFonts();
    loadThemes();
    initializeEventListeners();
});

// Tab switching
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Add active class to clicked tab
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success) {
            currentConfig = data.config;
            populateForm(currentConfig);
            // Auto generate HTML preview on load (instant)
            setTimeout(() => {
                previewImage();
            }, 100);
        } else {
            showToast('加载配置失败', 'error');
        }
    } catch (error) {
        console.error('Error loading config:', error);
        showToast('加载配置时出错', 'error');
    }
}

// Populate form with config data
function populateForm(config) {
    // Basic Info
    if (config.bot_info) {
        document.getElementById('botName').value = config.bot_info.name || '';
        document.getElementById('botQQ').value = config.bot_info.qq || '';
        document.getElementById('botDescription').value = config.bot_info.description || '';
        document.getElementById('botNotice').value = config.bot_info.notice || '';
        document.getElementById('cornerBadgeText').value = config.bot_info.corner_badge || '';
        document.getElementById('cornerBadgePosition').value = config.bot_info.corner_badge_position || 'top-right';
    }

    // Layout
    if (config.layout) {
        document.getElementById('itemsPerRow').value = config.layout.items_per_row || 3;
        document.getElementById('cardWidth').value = config.layout.card_width || 200;
        document.getElementById('cardHeight').value = config.layout.card_height || 80;
        document.getElementById('padding').value = config.layout.padding || 20;
        document.getElementById('spacing').value = config.layout.spacing || 15;
    }

    // Theme
    if (config.theme) {
        document.getElementById('backgroundType').value = config.theme.background_type || 'gradient';
        updateBackgroundOptions();

        if (config.theme.background_gradient && config.theme.background_gradient.length >= 2) {
            const color1 = config.theme.background_gradient[0];
            const color2 = config.theme.background_gradient[1];
            document.getElementById('gradientColor1').value = color1;
            document.getElementById('gradientColor2').value = color2;
            document.getElementById('gradientColor1Text').value = formatColorAsHex(color1);
            document.getElementById('gradientColor2Text').value = formatColorAsHex(color2);
        }
        const angleValue = config.theme.angle || 135;
        document.getElementById('gradientAngle').value = angleValue;
        document.getElementById('gradientAngleSlider').value = angleValue;

        const solidColor = config.theme.background_color || '#f5f5f5';
        document.getElementById('solidColor').value = solidColor;
        document.getElementById('solidColorText').value = formatColorAsHex(solidColor);

        const cardBg = config.theme.card_background || '#ffffff';
        const cardBorder = config.theme.card_border || '#e0e0e0';
        const titleColor = config.theme.title_color || '#333333';
        const subtitleColor = config.theme.subtitle_color || '#666666';

        document.getElementById('cardBackground').value = cardBg;
        document.getElementById('cardBackgroundText').value = formatColorAsHex(cardBg);
        document.getElementById('cardBorder').value = cardBorder;
        document.getElementById('cardBorderText').value = formatColorAsHex(cardBorder);
        document.getElementById('titleColor').value = titleColor;
        document.getElementById('titleColorText').value = formatColorAsHex(titleColor);
        document.getElementById('subtitleColor').value = subtitleColor;
        document.getElementById('subtitleColorText').value = formatColorAsHex(subtitleColor);
    }

    // Fonts
    if (config.fonts) {
        document.getElementById('titleFont').value = config.fonts.title_font || 'default';
        document.getElementById('contentFont').value = config.fonts.content_font || 'default';
        document.getElementById('titleBold').checked = config.fonts.title_bold || false;
        document.getElementById('titleItalic').checked = config.fonts.title_italic || false;
        document.getElementById('contentBold').checked = config.fonts.content_bold || false;
        document.getElementById('contentItalic').checked = config.fonts.content_italic || false;
        document.getElementById('titleSize').value = config.fonts.title_size || 32;
        document.getElementById('subtitleSize').value = config.fonts.subtitle_size || 18;
        document.getElementById('cardTitleSize').value = config.fonts.card_title_size || 16;
        document.getElementById('cardDescSize').value = config.fonts.card_desc_size || 12;
    }

    // Sections
    if (config.sections) {
        renderSections(config.sections);
    }

    // Update delete buttons visibility
    updateDeleteButtons();
}

// Render sections
function renderSections(sections) {
    const container = document.getElementById('sectionsContainer');
    container.innerHTML = '';

    sections.forEach((section, sectionIndex) => {
        const sectionDiv = createSectionElement(section, sectionIndex);
        container.appendChild(sectionDiv);
    });

    // Add event listeners to dynamically created inputs
    attachFormListeners();
}

// Create section element
function createSectionElement(section, sectionIndex) {
    const div = document.createElement('div');
    div.className = 'section-item';
    div.innerHTML = `
        <div class="section-header" onclick="toggleSection(${sectionIndex})">
            <div class="section-title-wrapper">
                <span class="section-toggle">▼</span>
                <h4>${section.name || '板块 ' + (sectionIndex + 1)} (${section.items ? section.items.length : 0})</h4>
            </div>
            <div class="section-actions" onclick="event.stopPropagation()">
                <button class="btn btn-secondary btn-sm" onclick="addItem(${sectionIndex})">+ 命令</button>
                <button class="btn btn-danger btn-sm" onclick="removeSection(${sectionIndex})">删除</button>
            </div>
        </div>
        <div class="section-content" id="section-content-${sectionIndex}">
            <div class="section-form-group">
                <label>板块名称</label>
                <input type="text" class="form-control section-name" value="${section.name || ''}" data-section="${sectionIndex}">
            </div>
            <div class="section-form-group">
                <label>板块图标</label>
                <input type="text" class="form-control section-icon" value="${section.icon || ''}" data-section="${sectionIndex}" placeholder="留空或输入文字标签">
            </div>
            <div class="items-container" id="items-${sectionIndex}">
                ${section.items ? section.items.map((item, itemIndex) => createItemHTML(item, sectionIndex, itemIndex)).join('') : ''}
            </div>
        </div>
    `;
    return div;
}

// Toggle section collapse
function toggleSection(sectionIndex) {
    const content = document.getElementById(`section-content-${sectionIndex}`);
    const toggle = content.previousElementSibling.querySelector('.section-toggle');

    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        toggle.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
        toggle.classList.add('collapsed');
    }
}

// Create item HTML
function createItemHTML(item, sectionIndex, itemIndex) {
    const totalItems = currentConfig.sections[sectionIndex].items.length;
    const isFirst = itemIndex === 0;
    const isLast = itemIndex === totalItems - 1;

    return `
        <div class="item-card">
            <div class="item-header">
                <span style="font-weight: 600; color: #4a5568;">${item.icon || '📝'} ${item.name || '命令 ' + (itemIndex + 1)}</span>
                <div class="item-actions">
                    <button class="btn btn-sm" onclick="moveItemUp(${sectionIndex}, ${itemIndex})"
                            style="padding: 2px 6px; font-size: 0.7rem; background: #48bb78; color: white;"
                            ${isFirst ? 'disabled' : ''}
                            title="上移">↑</button>
                    <button class="btn btn-sm" onclick="moveItemDown(${sectionIndex}, ${itemIndex})"
                            style="padding: 2px 6px; font-size: 0.7rem; background: #48bb78; color: white;"
                            ${isLast ? 'disabled' : ''}
                            title="下移">↓</button>
                    <button class="btn btn-sm" onclick="addItemBelow(${sectionIndex}, ${itemIndex})"
                            style="padding: 2px 6px; font-size: 0.7rem; background: #667eea; color: white;"
                            title="在下方添加">+</button>
                    <button class="btn btn-danger btn-sm" onclick="removeItem(${sectionIndex}, ${itemIndex})"
                            style="padding: 2px 8px; font-size: 0.75rem;">×</button>
                </div>
            </div>
            <div class="item-fields">
                <div class="form-group">
                    <label>图标</label>
                    <input type="text" class="form-control item-icon" value="${item.icon || ''}" data-section="${sectionIndex}" data-item="${itemIndex}" placeholder="Emoji图标">
                </div>
                <div class="form-group">
                    <label>命令名称</label>
                    <input type="text" class="form-control item-name" value="${item.name || ''}" data-section="${sectionIndex}" data-item="${itemIndex}" placeholder="如: help">
                </div>
                <div class="form-group">
                    <label>功能描述</label>
                    <input type="text" class="form-control item-desc" value="${item.description || ''}" data-section="${sectionIndex}" data-item="${itemIndex}" placeholder="简要说明功能">
                </div>
                <div class="form-group">
                    <label>使用方法</label>
                    <input type="text" class="form-control item-usage" value="${item.usage || ''}" data-section="${sectionIndex}" data-item="${itemIndex}" placeholder="如: help [指令名]">
                </div>
            </div>
        </div>
    `;
}

// Add new section
function addSection() {
    if (!currentConfig.sections) {
        currentConfig.sections = [];
    }

    currentConfig.sections.push({
        name: '新板块',
        icon: '',
        items: []
    });

    renderSections(currentConfig.sections);
    autoPreview();
}

// Remove section
function removeSection(sectionIndex) {
    currentConfig.sections.splice(sectionIndex, 1);
    renderSections(currentConfig.sections);
    autoPreview();
}

// Add new item to section
function addItem(sectionIndex) {
    if (!currentConfig.sections[sectionIndex].items) {
        currentConfig.sections[sectionIndex].items = [];
    }

    currentConfig.sections[sectionIndex].items.push({
        name: '新命令',
        description: '命令描述',
        icon: '',
        usage: ''
    });

    renderSections(currentConfig.sections);
    autoPreview();
}

// Remove item from section
function removeItem(sectionIndex, itemIndex) {
    currentConfig.sections[sectionIndex].items.splice(itemIndex, 1);
    renderSections(currentConfig.sections);
    autoPreview();
}

// Move item up in the list
function moveItemUp(sectionIndex, itemIndex) {
    if (itemIndex === 0) return; // Already at top
    const items = currentConfig.sections[sectionIndex].items;
    // Swap with previous item
    [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]];
    renderSections(currentConfig.sections);
    autoPreview();
}

// Move item down in the list
function moveItemDown(sectionIndex, itemIndex) {
    const items = currentConfig.sections[sectionIndex].items;
    if (itemIndex === items.length - 1) return; // Already at bottom
    // Swap with next item
    [items[itemIndex], items[itemIndex + 1]] = [items[itemIndex + 1], items[itemIndex]];
    renderSections(currentConfig.sections);
    autoPreview();
}

// Add new item below current item
function addItemBelow(sectionIndex, itemIndex) {
    const items = currentConfig.sections[sectionIndex].items;
    // Insert at position after current item
    items.splice(itemIndex + 1, 0, {
        name: '新命令',
        description: '命令描述',
        icon: '',
        usage: ''
    });
    renderSections(currentConfig.sections);
    autoPreview();
}

// Collect config from form
function collectConfig() {
    const config = {
        bot_info: {
            name: document.getElementById('botName').value,
            qq: document.getElementById('botQQ').value,
            description: document.getElementById('botDescription').value,
            notice: document.getElementById('botNotice').value,
            corner_badge: document.getElementById('cornerBadgeText').value,
            corner_badge_position: document.getElementById('cornerBadgePosition').value,
            avatar: currentConfig?.bot_info?.avatar || '',
            logo: currentConfig?.bot_info?.logo || ''
        },
        layout: {
            items_per_row: parseInt(document.getElementById('itemsPerRow').value),
            card_width: parseInt(document.getElementById('cardWidth').value),
            card_height: parseInt(document.getElementById('cardHeight').value),
            padding: parseInt(document.getElementById('padding').value),
            spacing: parseInt(document.getElementById('spacing').value)
        },
        theme: {
            name: currentConfig?.theme?.name || 'custom',
            background_type: document.getElementById('backgroundType').value,
            background_color: document.getElementById('solidColor').value,
            background_gradient: [
                document.getElementById('gradientColor1').value,
                document.getElementById('gradientColor2').value
            ],
            angle: parseInt(document.getElementById('gradientAngleSlider').value),
            background_image: currentConfig?.theme?.background_image || '',
            card_background: document.getElementById('cardBackground').value,
            card_border: document.getElementById('cardBorder').value,
            card_shadow: 'rgba(0, 0, 0, 0.1)',
            title_color: document.getElementById('titleColor').value,
            subtitle_color: document.getElementById('subtitleColor').value,
            card_title_color: document.getElementById('titleColor').value,
            card_desc_color: document.getElementById('subtitleColor').value,
            icon_background: '#f0f0f0',
            icon_color: '#666666'
        },
        fonts: {
            title_font: document.getElementById('titleFont').value,
            content_font: document.getElementById('contentFont').value,
            title_bold: document.getElementById('titleBold').checked,
            title_italic: document.getElementById('titleItalic').checked,
            content_bold: document.getElementById('contentBold').checked,
            content_italic: document.getElementById('contentItalic').checked,
            title_size: parseInt(document.getElementById('titleSize').value),
            subtitle_size: parseInt(document.getElementById('subtitleSize').value),
            card_title_size: parseInt(document.getElementById('cardTitleSize').value),
            card_desc_size: parseInt(document.getElementById('cardDescSize').value)
        },
        sections: collectSections()
    };

    return config;
}

// Collect sections from form
function collectSections() {
    const sections = [];
    const sectionElements = document.querySelectorAll('.section-item');

    sectionElements.forEach((sectionEl, sectionIndex) => {
        const section = {
            name: sectionEl.querySelector('.section-name').value,
            icon: sectionEl.querySelector('.section-icon').value,
            items: []
        };

        const itemElements = sectionEl.querySelectorAll('.item-card');
        itemElements.forEach(itemEl => {
            const item = {
                icon: itemEl.querySelector('.item-icon').value,
                name: itemEl.querySelector('.item-name').value,
                description: itemEl.querySelector('.item-desc').value,
                usage: itemEl.querySelector('.item-usage').value
            };
            section.items.push(item);
        });

        sections.push(section);
    });

    return sections;
}

// Save configuration
async function saveConfig() {
    try {
        const config = collectConfig();
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (data.success) {
            currentConfig = config;
            showToast('配置保存成功', 'success');
        } else {
            showToast('保存配置失败', 'error');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        showToast('保存配置时出错', 'error');
    }
}

// Note: Change detection removed - HTML preview re-renders completely on each change (instant!)

// Render markdown in text
function renderMarkdown(text) {
    if (!text) return '';
    // Support bold: **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Remove links but keep text
    text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1');
    // Support line breaks: convert \n to <br>
    text = text.replace(/\n/g, '<br>');
    return text;
}

// Preview with HTML/CSS rendering (real-time)
function previewImage() {
    try {
        const config = collectConfig();
        renderLivePreview(config);
        lastRenderedConfig = JSON.parse(JSON.stringify(config));
    } catch (error) {
        console.error('Error rendering preview:', error);
    }
}

// Render live HTML preview
function renderLivePreview(config) {
    const previewContainer = document.querySelector('.preview-container');

    // Build HTML structure
    const botInfo = config.bot_info || {};
    const layout = config.layout || {};
    const theme = config.theme || {};
    const fonts = config.fonts || {};
    const sections = config.sections || [];

    // Calculate dimensions
    const padding = layout.padding || 20;
    const itemsPerRow = layout.items_per_row || 3;
    const cardWidth = layout.card_width || 200;
    const cardHeight = layout.card_height || 80;
    const spacing = layout.spacing || 15;

    const totalWidth = padding * 2 + (cardWidth + spacing) * itemsPerRow - spacing;

    // Generate custom font CSS if needed
    let fontStyleTag = '';
    const titleFont = fonts.title_font;
    const contentFont = fonts.content_font;
    const customFonts = new Set();

    if (titleFont && titleFont !== 'default') {
        customFonts.add(titleFont);
    }
    if (contentFont && contentFont !== 'default') {
        customFonts.add(contentFont);
    }

    if (customFonts.size > 0) {
        let fontFaceCSS = '';
        customFonts.forEach(fontFile => {
            // Extract font name from filename (remove extension)
            const fontName = fontFile.replace(/\.(ttf|otf)$/i, '');
            fontFaceCSS += `
                @font-face {
                    font-family: '${fontName}';
                    src: url('/fonts/${fontFile}');
                }
            `;
        });
        fontStyleTag = `<style>${fontFaceCSS}</style>`;
    }

    // Generate font family strings
    const getTitleFontFamily = () => {
        if (titleFont && titleFont !== 'default') {
            const fontName = titleFont.replace(/\.(ttf|otf)$/i, '');
            return `'${fontName}', 'Microsoft YaHei', sans-serif`;
        }
        return "'Microsoft YaHei', sans-serif";
    };

    const getContentFontFamily = () => {
        if (contentFont && contentFont !== 'default') {
            const fontName = contentFont.replace(/\.(ttf|otf)$/i, '');
            return `'${fontName}', 'Microsoft YaHei', sans-serif`;
        }
        return "'Microsoft YaHei', sans-serif";
    };

    // Generate font style strings
    const getTitleFontWeight = () => fonts.title_bold ? 'bold' : 'normal';
    const getTitleFontStyle = () => fonts.title_italic ? 'italic' : 'normal';
    const getContentFontWeight = () => fonts.content_bold ? 'bold' : 'normal';
    const getContentFontStyle = () => fonts.content_italic ? 'italic' : 'normal';

    // Generate background CSS
    let backgroundStyle = '';
    if (theme.background_type === 'gradient') {
        const colors = theme.background_gradient || ['#ffeef8', '#e6f3ff'];
        const angle = theme.angle || 135;
        backgroundStyle = `background: linear-gradient(${angle}deg, ${colors.join(', ')});`;
    } else if (theme.background_type === 'solid') {
        backgroundStyle = `background: ${theme.background_color || '#f5f5f5'};`;
    } else if (theme.background_type === 'image' && theme.background_image) {
        backgroundStyle = `background: url('${theme.background_image}') center/cover;`;
    }

    // Build HTML
    let html = `
        ${fontStyleTag}
        <div class="help-menu-preview" style="
            ${backgroundStyle}
            width: ${totalWidth}px;
            padding: ${padding}px;
            font-family: ${getContentFontFamily()};
            color: ${theme.title_color || '#333'};
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            position: relative;
        ">
            <!-- Corner Badge -->
            ${botInfo.corner_badge ? `
                <div style="
                    position: absolute;
                    ${botInfo.corner_badge_position === 'bottom-right' ? 'bottom: 8px; right: 8px;' : botInfo.corner_badge_position === 'bottom-left' ? 'bottom: 8px; left: 8px;' : 'top: 8px; right: 8px;'}
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(8px);
                    padding: 4px 8px;
                    border-radius: 0;
                    font-size: ${Math.min(fonts.card_desc_size || 12, 9)}px;
                    color: ${theme.subtitle_color || '#666'};
                    font-family: ${getContentFontFamily()};
                    font-weight: ${getContentFontWeight()};
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    z-index: 10;
                    white-space: nowrap;
                ">
                    ${renderMarkdown(botInfo.corner_badge)}
                </div>
            ` : ''}
            <!-- Header -->
            <div class="preview-header" style="margin-bottom: 30px; display: flex; align-items: flex-start; justify-content: space-between;">
                <div style="display: flex; align-items: flex-start;">
                    ${botInfo.avatar ? `<img src="${botInfo.avatar}" style="width: 80px; height: 80px; border-radius: 50%; margin-right: 20px;" onerror="this.style.display='none'" />` : ''}
                    <div>
                        <div style="font-size: ${fonts.title_size || 32}px; font-weight: ${getTitleFontWeight()}; font-style: ${getTitleFontStyle()}; color: ${theme.title_color || '#333'}; margin-bottom: 10px; font-family: ${getTitleFontFamily()};">
                            ${renderMarkdown(botInfo.name || 'Bot')}
                        </div>
                        ${botInfo.qq ? `<div style="font-size: ${fonts.subtitle_size || 18}px; color: ${theme.subtitle_color || '#666'}; margin-bottom: 8px; font-family: ${getContentFontFamily()}; font-weight: ${getContentFontWeight()}; font-style: ${getContentFontStyle()};">QQ: ${botInfo.qq}</div>` : ''}
                        ${botInfo.description ? `<div style="font-size: ${fonts.card_desc_size || 12}px; color: ${theme.subtitle_color || '#666'}; margin-bottom: 5px; font-family: ${getContentFontFamily()}; font-weight: ${getContentFontWeight()}; font-style: ${getContentFontStyle()};">${renderMarkdown(botInfo.description)}</div>` : ''}
                        ${botInfo.notice ? `<div style="font-size: ${fonts.card_desc_size || 12}px; color: ${theme.subtitle_color || '#666'}; font-family: ${getContentFontFamily()}; font-weight: ${getContentFontWeight()}; font-style: ${getContentFontStyle()};">${renderMarkdown(botInfo.notice)}</div>` : ''}
                    </div>
                </div>
                ${botInfo.logo ? `<img src="${botInfo.logo}" style="max-width: 80px; max-height: 80px; margin-left: 20px; object-fit: contain; width: auto; height: auto;" onerror="this.style.display='none'" />` : ''}
            </div>

            <!-- Sections -->
            ${sections.map(section => {
                const items = section.items || [];
                return `
                    <div class="preview-section" style="margin-bottom: 30px;">
                        <div style="font-size: ${fonts.subtitle_size || 18}px; font-weight: ${getContentFontWeight()}; font-style: ${getContentFontStyle()}; color: ${theme.title_color || '#333'}; margin-bottom: 15px; font-family: ${getContentFontFamily()};">
                            ${section.icon ? section.icon + ' ' : ''}${renderMarkdown(section.name || '')}
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(${itemsPerRow}, ${cardWidth}px); gap: ${spacing}px;">
                            ${items.map(item => `
                                <div style="
                                    background: ${theme.card_background || '#fff'};
                                    border: 2px solid ${theme.card_border || '#e0e0e0'};
                                    border-radius: 10px;
                                    min-height: ${cardHeight}px;
                                    padding: 12px;
                                    display: flex;
                                    flex-direction: column;
                                    justify-content: flex-start;
                                    position: relative;
                                    box-sizing: border-box;
                                ">
                                    ${item.icon ? `<span style="position: absolute; left: 12px; top: 12px; font-size: ${Math.min(fonts.card_title_size || 16, 20)}px; line-height: 1;">${item.icon}</span>` : ''}
                                    <div style="
                                        font-size: ${Math.min(fonts.card_title_size || 16, 16)}px;
                                        color: ${theme.card_title_color || '#444'};
                                        margin-bottom: 4px;
                                        font-weight: ${getContentFontWeight()};
                                        font-style: ${getContentFontStyle()};
                                        font-family: ${getContentFontFamily()};
                                        ${item.icon ? 'margin-left: 30px;' : ''}
                                        line-height: 1.3;
                                        word-break: break-word;
                                    ">
                                        ${renderMarkdown(item.name || '')}
                                    </div>
                                    <div style="
                                        font-size: ${Math.min(fonts.card_desc_size || 12, 12)}px;
                                        color: ${theme.card_desc_color || '#888'};
                                        font-weight: ${getContentFontWeight()};
                                        font-style: ${getContentFontStyle()};
                                        font-family: ${getContentFontFamily()};
                                        ${item.icon ? 'margin-left: 30px;' : ''}
                                        margin-bottom: 3px;
                                        line-height: 1.4;
                                        word-break: break-word;
                                    ">
                                        ${renderMarkdown(item.description || '')}
                                    </div>
                                    ${item.usage ? `<div style="
                                        font-size: ${Math.min((fonts.card_desc_size || 12) * 0.85, 10)}px;
                                        color: ${theme.card_desc_color || '#888'};
                                        font-weight: normal;
                                        font-style: italic;
                                        font-family: ${getContentFontFamily()};
                                        ${item.icon ? 'margin-left: 30px;' : ''}
                                        opacity: 0.75;
                                        line-height: 1.3;
                                        word-break: break-word;
                                    ">
                                        用法: ${item.usage}
                                    </div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    previewContainer.innerHTML = html;
}


// Generate and save image
async function generateImage() {
    try {
        showLoading();

        const response = await fetch('/api/generate', {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            displayPreview(data.image);
            showToast('图片生成成功！已保存到 output 目录', 'success');
        } else {
            hideLoading();
            showToast('生成图片失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('Error generating image:', error);
        hideLoading();
        showToast('生成图片时出错', 'error');
    }
}

// Upload file
async function uploadFile(fileInput, fileType) {
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`/api/upload/${fileType}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(`${fileType} 上传成功`, 'success');

            // Update config with file path
            if (fileType === 'avatar') {
                if (!currentConfig.bot_info) currentConfig.bot_info = {};
                currentConfig.bot_info.avatar = data.path;
                document.getElementById('avatarFileName').textContent = data.filename;
                updateDeleteButtons();
            } else if (fileType === 'logo') {
                if (!currentConfig.bot_info) currentConfig.bot_info = {};
                currentConfig.bot_info.logo = data.path;
                document.getElementById('logoFileName').textContent = data.filename;
                updateDeleteButtons();
            } else if (fileType === 'background') {
                if (!currentConfig.theme) currentConfig.theme = {};
                currentConfig.theme.background_image = data.path;
                document.getElementById('backgroundFileName').textContent = data.filename;
            } else if (fileType === 'font') {
                document.getElementById('fontFileName').textContent = data.filename;
                await loadFonts();
            }

            // Trigger auto preview after file upload
            autoPreview();
        } else {
            showToast(`上传失败: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        showToast('上传文件时出错', 'error');
    }
}

// Load available fonts
async function loadFonts() {
    try {
        const response = await fetch('/api/fonts');
        const data = await response.json();

        if (data.success) {
            availableFonts = data.fonts;
            updateFontSelects();
        }
    } catch (error) {
        console.error('Error loading fonts:', error);
    }
}

// Update font select options
function updateFontSelects() {
    const titleFontSelect = document.getElementById('titleFont');
    const contentFontSelect = document.getElementById('contentFont');

    [titleFontSelect, contentFontSelect].forEach(select => {
        const currentValue = select.value;
        select.innerHTML = availableFonts.map(font =>
            `<option value="${font}">${font}</option>`
        ).join('');
        select.value = currentValue;
    });
}

// Load preset themes
async function loadThemes() {
    try {
        const response = await fetch('/api/themes');
        const data = await response.json();

        if (data.success) {
            presetThemes = data.themes;
            updateThemeSelect();
        }
    } catch (error) {
        console.error('Error loading themes:', error);
    }
}

// Update theme select options
function updateThemeSelect() {
    const select = document.getElementById('presetTheme');
    let html = '<option value="">选择预设主题</option>';

    // Priority themes first (Sweet Cherry and Midnight Deep)
    const priorityThemes = ['default', 'dark_mode'];
    priorityThemes.forEach(key => {
        if (presetThemes[key]) {
            html += `<option value="${key}">${presetThemes[key].name}</option>`;
        }
    });

    // Add separator
    html += '<option disabled>────────────</option>';

    // Other themes
    Object.entries(presetThemes).forEach(([key, theme]) => {
        if (!priorityThemes.includes(key)) {
            html += `<option value="${key}">${theme.name}</option>`;
        }
    });

    select.innerHTML = html;
}

// Apply preset theme
async function applyPresetTheme(themeName) {
    if (!themeName) return;

    try {
        // Get theme data
        const themeData = presetThemes[themeName];

        // Collect current config from form (preserve user's unsaved changes)
        const config = collectConfig();

        // Update only theme settings
        config.theme = {
            name: themeName,
            background_type: 'gradient',
            background_gradient: themeData['background_gradient'],
            angle: themeData['angle'] || 135,
            background_color: config.theme?.background_color || '#f5f5f5',
            background_image: config.theme?.background_image || '',
            card_background: themeData['card_background'],
            card_border: themeData['card_border'],
            card_shadow: 'rgba(0, 0, 0, 0.1)',
            title_color: themeData['title_color'],
            subtitle_color: themeData['subtitle_color'],
            card_title_color: themeData['title_color'],
            card_desc_color: themeData['subtitle_color'],
            icon_background: '#f0f0f0',
            icon_color: '#666666'
        };

        // Update current config
        currentConfig = config;

        // Update only theme-related form fields
        document.getElementById('backgroundType').value = 'gradient';
        updateBackgroundOptions();

        const color1 = themeData['background_gradient'][0];
        const color2 = themeData['background_gradient'][1];
        document.getElementById('gradientColor1').value = color1;
        document.getElementById('gradientColor1Text').value = formatColorAsHex(color1);
        document.getElementById('gradientColor2').value = color2;
        document.getElementById('gradientColor2Text').value = formatColorAsHex(color2);
        const themeAngle = themeData['angle'] || 135;
        document.getElementById('gradientAngle').value = themeAngle;
        document.getElementById('gradientAngleSlider').value = themeAngle;

        const cardBg = themeData['card_background'];
        const cardBorder = themeData['card_border'];
        const titleColor = themeData['title_color'];
        const subtitleColor = themeData['subtitle_color'];

        document.getElementById('cardBackground').value = cardBg;
        document.getElementById('cardBackgroundText').value = formatColorAsHex(cardBg);
        document.getElementById('cardBorder').value = cardBorder;
        document.getElementById('cardBorderText').value = formatColorAsHex(cardBorder);
        document.getElementById('titleColor').value = titleColor;
        document.getElementById('titleColorText').value = formatColorAsHex(titleColor);
        document.getElementById('subtitleColor').value = subtitleColor;
        document.getElementById('subtitleColorText').value = formatColorAsHex(subtitleColor);

        // Auto save the configuration to backend
        const saveResponse = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        const saveData = await saveResponse.json();

        if (saveData.success) {
            showToast(`已应用主题: ${themeData.name}（已自动保存）`, 'success');
        } else {
            showToast(`已应用主题: ${themeData.name}（但保存失败，请手动保存）`, 'error');
        }

        // Trigger auto preview after theme change
        autoPreview();
    } catch (error) {
        console.error('Error applying theme:', error);
        showToast('应用主题时出错', 'error');
    }
}

// Update background options based on type
function updateBackgroundOptions() {
    const type = document.getElementById('backgroundType').value;

    document.getElementById('gradientOptions').style.display = type === 'gradient' ? 'block' : 'none';
    document.getElementById('solidOptions').style.display = type === 'solid' ? 'block' : 'none';
}

// Note: Loading functions removed - HTML preview is instant!

// Download image - generate PNG from backend
async function downloadImage() {
    try {
        // Check if html2canvas is loaded
        if (typeof html2canvas === 'undefined') {
            showToast('正在加载图片生成库，请稍后再试...', 'error');
            return;
        }

        showToast('正在生成图片...', 'success');

        // Get the preview element
        const previewElement = document.querySelector('.help-menu-preview');

        if (!previewElement) {
            showToast('请先生成预览', 'error');
            return;
        }

        // Use html2canvas to capture the preview
        const canvas = await html2canvas(previewElement, {
            backgroundColor: null,
            scale: 2, // Higher quality
            logging: false,
            useCORS: true, // Allow cross-origin images
            allowTaint: true
        });

        // Convert canvas to blob
        canvas.toBlob((blob) => {
            if (blob) {
                // Create download link
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `help_menu_${Date.now()}.png`;
                link.href = url;
                link.click();

                // Clean up
                URL.revokeObjectURL(url);
                showToast('图片已下载', 'success');
            } else {
                showToast('生成图片失败', 'error');
            }
        }, 'image/png');

    } catch (error) {
        console.error('Error downloading image:', error);
        showToast('下载图片时出错: ' + error.message, 'error');
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Attach listeners to all form inputs
function attachFormListeners() {
    // Listen to all form inputs for auto-preview
    const formInputs = document.querySelectorAll('.form-control');
    formInputs.forEach(input => {
        // Remove existing listeners to avoid duplicates
        input.removeEventListener('input', autoPreview);
        input.removeEventListener('change', autoPreview);

        // Add new listeners
        input.addEventListener('input', autoPreview);
        input.addEventListener('change', autoPreview);
    });
}

// Setup color input synchronization
function setupColorInputSync(colorPickerId, colorTextId) {
    const picker = document.getElementById(colorPickerId);
    const text = document.getElementById(colorTextId);

    if (!picker || !text) return;

    // Sync picker -> text (show as hex)
    picker.addEventListener('input', function() {
        text.value = formatColorAsHex(this.value);
        autoPreview();
    });

    // Sync text -> picker (accept hex or rgb)
    text.addEventListener('blur', function() {
        const parsedColor = parseColorInput(this.value);
        if (parsedColor) {
            picker.value = parsedColor;
            this.value = formatColorAsHex(parsedColor);
            autoPreview();
        } else {
            // Reset to current picker value if invalid
            this.value = formatColorAsHex(picker.value);
        }
    });

    // Also sync on Enter key
    text.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
}

// Initialize color inputs
function initializeColorInputs() {
    // Initialize all color input pairs
    const colorPairs = [
        ['gradientColor1', 'gradientColor1Text'],
        ['gradientColor2', 'gradientColor2Text'],
        ['solidColor', 'solidColorText'],
        ['cardBackground', 'cardBackgroundText'],
        ['cardBorder', 'cardBorderText'],
        ['titleColor', 'titleColorText'],
        ['subtitleColor', 'subtitleColorText']
    ];

    colorPairs.forEach(([pickerId, textId]) => {
        setupColorInputSync(pickerId, textId);

        // Initialize text field with current picker value
        const picker = document.getElementById(pickerId);
        const text = document.getElementById(textId);
        if (picker && text && picker.value) {
            text.value = formatColorAsHex(picker.value);
        }
    });
}

// Setup gradient angle sync between dropdown and slider
function setupGradientAngleSync() {
    const angleSelect = document.getElementById('gradientAngle');
    const angleSlider = document.getElementById('gradientAngleSlider');

    if (!angleSelect || !angleSlider) return;

    // Dropdown -> Slider: Only update slider when dropdown changes
    angleSelect.addEventListener('change', function() {
        angleSlider.value = this.value;
        autoPreview();
    });

    // Slider -> Preview: Update preview when slider changes, but don't sync back to dropdown
    angleSlider.addEventListener('input', function() {
        autoPreview();
    });

    angleSlider.addEventListener('change', function() {
        autoPreview();
    });
}

// Initialize event listeners
function initializeEventListeners() {
    // Initialize color inputs
    initializeColorInputs();

    // Setup gradient angle sync
    setupGradientAngleSync();

    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveConfig);

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generateImage);

    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);

    // Add section button
    document.getElementById('addSectionBtn').addEventListener('click', addSection);

    // Background type change
    document.getElementById('backgroundType').addEventListener('change', function() {
        updateBackgroundOptions();
        autoPreview();
    });

    // Preset theme change
    document.getElementById('presetTheme').addEventListener('change', function() {
        applyPresetTheme(this.value);
    });

    // File uploads
    document.getElementById('avatarUpload').addEventListener('change', function() {
        uploadFile(this, 'avatar');
    });

    document.getElementById('logoUpload').addEventListener('change', function() {
        uploadFile(this, 'logo');
    });

    document.getElementById('fontUpload').addEventListener('change', function() {
        uploadFile(this, 'font');
    });

    // Font style checkboxes
    document.getElementById('titleBold').addEventListener('change', autoPreview);
    document.getElementById('titleItalic').addEventListener('change', autoPreview);
    document.getElementById('contentBold').addEventListener('change', autoPreview);
    document.getElementById('contentItalic').addEventListener('change', autoPreview);

    // Corner badge position change
    document.getElementById('cornerBadgePosition').addEventListener('change', autoPreview);

    // Attach listeners to all form inputs
    attachFormListeners();

    // Initialize icon picker
    initializeIconPicker();
}

// ==================== Icon Picker System ====================

// Icon database organized by category
const iconDatabase = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱'],
    people: ['👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰', '👱‍♀️', '👱‍♂️', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '👴', '👵', '🙍', '🙍‍♂️', '🙎', '🙎‍♂️', '🙅', '🙅‍♂️', '🙆', '🙆‍♂️', '💁', '💁‍♂️', '🙋', '🙋‍♂️', '🧏', '🧏‍♂️', '🙇', '🙇‍♂️', '🤦', '🤦‍♂️', '🤷', '🤷‍♂️', '👮', '👮‍♂️', '💂', '💂‍♂️', '👷', '👷‍♂️', '🤴', '👸', '👳', '👳‍♂️', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦸‍♂️', '🦹', '🦹‍♂️', '🧙', '🧙‍♂️', '🧚', '🧚‍♂️', '🧛', '🧛‍♂️', '🧜', '🧜‍♂️', '🧝', '🧝‍♂️', '🧞', '🧞‍♂️', '🧟', '🧟‍♂️'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    food: ['🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🥝', '🍅', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧃', '🧉', '🧊'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋'],
    objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '💊', '💉', '🩸', '🩹', '🩺', '🌡️', '🧬', '🦠', '🧫', '🧪', '🧻', '🚰', '🚿', '🛁', '🛀', '🧴', '🧷', '🧹', '🧺', '🧻', '🪒', '🧽', '🧼', '🪥', '🪒', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
};

// Current target input for icon selection
let currentIconTarget = null;

// Initialize icon picker
function initializeIconPicker() {
    // Initialize icon picker tabs
    const iconTabs = document.querySelectorAll('.icon-tab');
    iconTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            iconTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            // Render icons for selected category
            const category = this.getAttribute('data-category');
            renderIcons(category);
        });
    });

    // Initialize search
    const searchInput = document.getElementById('iconSearchInput');
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        if (query) {
            searchIcons(query);
        } else {
            // Show all icons if search is empty
            const activeTab = document.querySelector('.icon-tab.active');
            const category = activeTab ? activeTab.getAttribute('data-category') : 'all';
            renderIcons(category);
        }
    });

    // Render all icons by default
    renderIcons('all');
}

// Open icon picker
function openIconPicker(inputElement) {
    currentIconTarget = inputElement;
    const modal = document.getElementById('iconPickerModal');
    modal.style.display = 'flex';
    // Clear search
    document.getElementById('iconSearchInput').value = '';
    // Reset to all category
    document.querySelectorAll('.icon-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.icon-tab[data-category="all"]').classList.add('active');
    renderIcons('all');
}

// Close icon picker
function closeIconPicker() {
    const modal = document.getElementById('iconPickerModal');
    modal.style.display = 'none';
    currentIconTarget = null;
}

// Render icons for a specific category
function renderIcons(category) {
    const body = document.getElementById('iconPickerBody');
    body.innerHTML = '';

    let iconsToRender = [];

    if (category === 'all') {
        // Show all icons from all categories
        Object.values(iconDatabase).forEach(categoryIcons => {
            iconsToRender = iconsToRender.concat(categoryIcons);
        });
    } else if (iconDatabase[category]) {
        iconsToRender = iconDatabase[category];
    }

    // Create icon elements
    iconsToRender.forEach(icon => {
        const iconEl = document.createElement('div');
        iconEl.className = 'icon-item';
        iconEl.textContent = icon;
        iconEl.onclick = function() {
            selectIcon(icon);
        };
        body.appendChild(iconEl);
    });
}

// Search icons
function searchIcons(query) {
    const body = document.getElementById('iconPickerBody');
    body.innerHTML = '';

    // Note: Since emojis don't have names in this simple implementation,
    // we just filter by checking if the emoji is in our database
    // In a more advanced implementation, you could have icon names/tags

    let foundIcons = [];
    Object.values(iconDatabase).forEach(categoryIcons => {
        categoryIcons.forEach(icon => {
            // Simple search - just show all icons for now
            // You could implement emoji name search with a proper emoji library
            foundIcons.push(icon);
        });
    });

    // If no specific search logic, just show all icons
    foundIcons = foundIcons.slice(0, 100); // Limit to first 100 for performance

    foundIcons.forEach(icon => {
        const iconEl = document.createElement('div');
        iconEl.className = 'icon-item';
        iconEl.textContent = icon;
        iconEl.onclick = function() {
            selectIcon(icon);
        };
        body.appendChild(iconEl);
    });
}

// Select an icon
function selectIcon(icon) {
    if (currentIconTarget) {
        currentIconTarget.value = icon;
        // Trigger input event to update preview
        currentIconTarget.dispatchEvent(new Event('input', { bubbles: true }));
        autoPreview();
    }
    closeIconPicker();
}

// Delete avatar
function deleteAvatar() {
    if (currentConfig && currentConfig.bot_info) {
        currentConfig.bot_info.avatar = '';
    }
    document.getElementById('avatarUpload').value = '';
    document.getElementById('avatarFileName').textContent = '';
    document.getElementById('avatarDeleteBtn').style.display = 'none';
    autoPreview();
    showToast('头像已删除', 'success');
}

// Delete logo
function deleteLogo() {
    if (currentConfig && currentConfig.bot_info) {
        currentConfig.bot_info.logo = '';
    }
    document.getElementById('logoUpload').value = '';
    document.getElementById('logoFileName').textContent = '';
    document.getElementById('logoDeleteBtn').style.display = 'none';
    autoPreview();
    showToast('Logo 已删除', 'success');
}

// Show/hide delete buttons based on file status
function updateDeleteButtons() {
    const avatarFileName = document.getElementById('avatarFileName').textContent.trim();
    const logoFileName = document.getElementById('logoFileName').textContent.trim();

    document.getElementById('avatarDeleteBtn').style.display = avatarFileName ? 'inline-block' : 'none';
    document.getElementById('logoDeleteBtn').style.display = logoFileName ? 'inline-block' : 'none';
}

// Attach icon picker to icon inputs
function attachIconPickerToInputs() {
    // Attach to all item-icon inputs
    document.querySelectorAll('.item-icon').forEach(input => {
        input.removeEventListener('click', handleIconInputClick);
        input.addEventListener('click', handleIconInputClick);
    });

    // Attach to all section-icon inputs
    document.querySelectorAll('.section-icon').forEach(input => {
        input.removeEventListener('click', handleIconInputClick);
        input.addEventListener('click', handleIconInputClick);
    });
}

// Handle icon input click
function handleIconInputClick(event) {
    openIconPicker(event.target);
}

// Override renderSections to attach icon picker listeners
const originalRenderSections = renderSections;
renderSections = function(sections) {
    originalRenderSections(sections);
    // Attach icon picker listeners after rendering sections
    setTimeout(() => {
        attachIconPickerToInputs();
    }, 100);
};
