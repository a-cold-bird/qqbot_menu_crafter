from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image, ImageDraw, ImageFont
import yaml
import os
import io
import base64
import re
from datetime import datetime
import threading

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['FONT_FOLDER'] = 'fonts'
app.config['OUTPUT_FOLDER'] = 'output'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Ensure directories exist
for folder in [app.config['UPLOAD_FOLDER'], app.config['FONT_FOLDER'], app.config['OUTPUT_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

# Global config cache
config_cache = {}
config_lock = threading.Lock()

# Built-in color themes
PRESET_THEMES = {
    'default': {
        'name': 'Sweet Cherry',
        'background_gradient': ['#ffe5ec', '#ffd6e0'],
        'angle': 135,
        'card_background': '#ffffff',
        'card_border': '#f0cfd4',
        'title_color': '#c2185b',
        'subtitle_color': '#d81b60',
    },
    'dark_mode': {
        'name': 'Midnight Deep',
        'background_gradient': ['#1a1a2e', '#16213e'],
        'angle': 180,
        'card_background': '#1e293b',
        'card_border': '#0f172a',
        'title_color': '#e2e8f0',
        'subtitle_color': '#cbd5e1',
    },
    'purple_dream': {
        'name': 'Purple Fantasy',
        'background_gradient': ['#e0c3fc', '#8ec5fc'],
        'angle': 120,
        'card_background': '#ffffff',
        'card_border': '#d4b5f5',
        'title_color': '#512da8',
        'subtitle_color': '#673ab7',
    },
    'green_fresh': {
        'name': 'Forest Fresh',
        'background_gradient': ['#c8e6c9', '#81c784'],
        'angle': 90,
        'card_background': '#f1f8e9',
        'card_border': '#a5d6a7',
        'title_color': '#1b5e20',
        'subtitle_color': '#2e7d32',
    },
    'orange_vibrant': {
        'name': 'Sunset Warmth',
        'background_gradient': ['#ffe0b2', '#ffb74d'],
        'angle': 45,
        'card_background': '#ffffff',
        'card_border': '#ffd699',
        'title_color': '#e65100',
        'subtitle_color': '#f57c00',
    },
    'sunset': {
        'name': 'Evening Glow',
        'background_gradient': ['#ff6b6b', '#ffa94d', '#ffd43b'],
        'angle': 135,
        'card_background': '#ffffff',
        'card_border': '#ffc0d9',
        'title_color': '#c62828',
        'subtitle_color': '#e03131',
    },
    'ocean': {
        'name': 'Ocean Azure',
        'background_gradient': ['#0096ff', '#1fc0ff'],
        'angle': 90,
        'card_background': '#f0f8ff',
        'card_border': '#81d4fa',
        'title_color': '#00467f',
        'subtitle_color': '#0277bd',
    },
    'cherry_blossom': {
        'name': 'Cherry Bloom',
        'background_gradient': ['#f8bbd0', '#ff80ab'],
        'angle': 120,
        'card_background': '#fff9e6',
        'card_border': '#f8bbd0',
        'title_color': '#880e4f',
        'subtitle_color': '#ad1457',
    },
    'mint_fresh': {
        'name': 'Mint Cool',
        'background_gradient': ['#b2dfdb', '#80deea'],
        'angle': 45,
        'card_background': '#e0f2f1',
        'card_border': '#80cbc4',
        'title_color': '#00695c',
        'subtitle_color': '#00796b',
    },
    'lavender_dream': {
        'name': 'Lavender Dream',
        'background_gradient': ['#e1bee7', '#ce93d8'],
        'angle': 135,
        'card_background': '#f3e5f5',
        'card_border': '#e0bee7',
        'title_color': '#6a1b9a',
        'subtitle_color': '#7b1fa2',
    },
    'golden_hour': {
        'name': 'Golden Hour',
        'background_gradient': ['#fff9c4', '#ffeb3b'],
        'angle': 90,
        'card_background': '#fffde7',
        'card_border': '#ffeb3b',
        'title_color': '#b8860b',
        'subtitle_color': '#cd853f',
    },
    'blush_pink': {
        'name': 'Blush Pink',
        'background_gradient': ['#ffccdd', '#ff99cc'],
        'angle': 180,
        'card_background': '#ffffff',
        'card_border': '#ffb3d9',
        'title_color': '#b2102f',
        'subtitle_color': '#d32f2f',
    },
    'teal_elegance': {
        'name': 'Teal Elegance',
        'background_gradient': ['#b2dfdb', '#4db6ac'],
        'angle': 120,
        'card_background': '#e0f2f1',
        'card_border': '#80cbc4',
        'title_color': '#00251a',
        'subtitle_color': '#004d40',
    },
    'coral_reef': {
        'name': 'Coral Reef',
        'background_gradient': ['#ffab91', '#ff7043'],
        'angle': 45,
        'card_background': '#ffe0d2',
        'card_border': '#ffab91',
        'title_color': '#5d2c0c',
        'subtitle_color': '#8b4513',
    },
    'midnight_blue': {
        'name': 'Midnight Sapphire',
        'background_gradient': ['#1a237e', '#283593'],
        'angle': 180,
        'card_background': '#3f51b5',
        'card_border': '#1a237e',
        'title_color': '#e8eaf6',
        'subtitle_color': '#c5cae9',
    },
    'spring_bud': {
        'name': 'Spring Bud',
        'background_gradient': ['#dcedc8', '#aed581'],
        'angle': 90,
        'card_background': '#f1f8e9',
        'card_border': '#c5e1a5',
        'title_color': '#33691e',
        'subtitle_color': '#558b2f',
    },
}


def load_config():
    """Load configuration from YAML file"""
    with config_lock:
        try:
            with open('config.yaml', 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                config_cache.clear()
                config_cache.update(config)
                return config
        except Exception as e:
            print(f"Error loading config: {e}")
            return None


class MultilineDumper(yaml.SafeDumper):
    """Custom YAML dumper to handle multiline strings properly"""
    pass

def str_representer(dumper, data):
    """Represent strings with newlines as block scalars for better readability"""
    if '\n' in data:
        # Use literal block scalar (|-) for multiline strings
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)

MultilineDumper.add_representer(str, str_representer)


def save_config(config):
    """Save configuration to YAML file"""
    with config_lock:
        try:
            with open('config.yaml', 'w', encoding='utf-8') as f:
                yaml.dump(config, f, Dumper=MultilineDumper,
                         allow_unicode=True, sort_keys=False)
            config_cache.clear()
            config_cache.update(config)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False


def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def create_gradient_background(width, height, colors, angle=135):
    """Create a gradient background"""
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)

    if len(colors) < 2:
        colors = colors + colors  # Duplicate if only one color

    # Convert hex colors to RGB
    rgb_colors = [hex_to_rgb(c) for c in colors]

    # Create gradient
    if angle in [0, 180]:  # Horizontal
        for x in range(width):
            ratio = x / width
            if angle == 180:
                ratio = 1 - ratio

            r = int(rgb_colors[0][0] + (rgb_colors[1][0] - rgb_colors[0][0]) * ratio)
            g = int(rgb_colors[0][1] + (rgb_colors[1][1] - rgb_colors[0][1]) * ratio)
            b = int(rgb_colors[0][2] + (rgb_colors[1][2] - rgb_colors[0][2]) * ratio)

            draw.line([(x, 0), (x, height)], fill=(r, g, b))
    elif angle in [90, 270]:  # Vertical
        for y in range(height):
            ratio = y / height
            if angle == 270:
                ratio = 1 - ratio

            r = int(rgb_colors[0][0] + (rgb_colors[1][0] - rgb_colors[0][0]) * ratio)
            g = int(rgb_colors[0][1] + (rgb_colors[1][1] - rgb_colors[0][1]) * ratio)
            b = int(rgb_colors[0][2] + (rgb_colors[1][2] - rgb_colors[0][2]) * ratio)

            draw.line([(0, y), (width, y)], fill=(r, g, b))
    else:  # Diagonal
        for y in range(height):
            for x in range(width):
                ratio = (x + y) / (width + height)
                if angle > 180:
                    ratio = 1 - ratio

                r = int(rgb_colors[0][0] + (rgb_colors[1][0] - rgb_colors[0][0]) * ratio)
                g = int(rgb_colors[0][1] + (rgb_colors[1][1] - rgb_colors[0][1]) * ratio)
                b = int(rgb_colors[0][2] + (rgb_colors[1][2] - rgb_colors[0][2]) * ratio)

                draw.point((x, y), fill=(r, g, b))

    return image


def get_font(font_name, size, emoji_support=False):
    """Get font object, fallback to default if not found"""
    try:
        if font_name and font_name != 'default':
            font_path = os.path.join(app.config['FONT_FOLDER'], font_name)
            if os.path.exists(font_path):
                return ImageFont.truetype(font_path, size)

        # If emoji support is needed, try emoji fonts first
        if emoji_support:
            emoji_fonts = [
                # Windows
                'C:\\Windows\\Fonts\\seguiemj.ttf',  # Segoe UI Emoji
                'C:\\Windows\\Fonts\\NotoColorEmoji.ttf',
                # Linux
                '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
                # macOS
                '/System/Library/Fonts/Apple Color Emoji.ttc',
            ]
            for font_path in emoji_fonts:
                if os.path.exists(font_path):
                    return ImageFont.truetype(font_path, size)

        # Try common system font paths (for Chinese characters)
        system_fonts = [
            # Windows - Chinese fonts work better
            'C:\\Windows\\Fonts\\msyh.ttc',  # Microsoft YaHei (supports Chinese and some emoji)
            'C:\\Windows\\Fonts\\simhei.ttf',  # SimHei
            'C:\\Windows\\Fonts\\simsun.ttc',  # SimSun
            'C:\\Windows\\Fonts\\arial.ttf',
            # Linux
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            # macOS
            '/System/Library/Fonts/PingFang.ttc',
            '/System/Library/Fonts/Helvetica.ttc',
        ]

        for font_path in system_fonts:
            if os.path.exists(font_path):
                return ImageFont.truetype(font_path, size)

        # If all fails, use default PIL font
        return ImageFont.load_default()
    except Exception as e:
        print(f"Error loading font: {e}")
        # If all fails, use default PIL font
        return ImageFont.load_default()


def clean_markdown(text):
    """Simple markdown cleanup for image rendering - now preserves formatting markers"""
    if not text:
        return ''
    # Remove only link markdown, keep bold/italic markers for rendering
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)  # [link](url) -> text
    return text


def draw_text_with_style(draw, position, text, font, color, bold=False, italic=False):
    """Draw text with bold/italic style support and multi-line support"""
    if not text:
        return

    x, y = position

    # Support multi-line text by splitting on newlines
    lines = text.split('\n')

    # Calculate line height (font size + spacing)
    try:
        # Try to get font size from bbox
        bbox = font.getbbox('Ay')
        line_height = bbox[3] - bbox[1] + 5  # Add 5px spacing
    except:
        # Fallback to estimated height
        line_height = 20

    # Draw each line
    for i, line in enumerate(lines):
        line_y = y + (i * line_height)

        if bold:
            # Simulate bold by drawing text multiple times with slight offsets
            for offset in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                draw.text((x + offset[0], line_y + offset[1]), line, fill=color, font=font)
        else:
            # Normal text
            draw.text((x, line_y), line, fill=color, font=font)

    # Note: Italic is not supported in PIL/Pillow without complex transformations
    # Users should use italic font files if needed


def draw_text_with_markdown(draw, position, text, font, color, bold=False, italic=False):
    """Draw text with basic markdown support (bold) and optional style"""
    if not text:
        return

    x, y = position
    current_x = x

    # Split text by bold markers
    parts = re.split(r'(\*\*.*?\*\*|__.*?__)', text)

    for part in parts:
        if not part:
            continue

        # Check if this part is bold
        is_bold = part.startswith('**') and part.endswith('**') or part.startswith('__') and part.endswith('__')

        if is_bold:
            # Remove markers
            clean_part = part[2:-2]
            # Draw bold by drawing the text multiple times with slight offsets
            for offset in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                draw.text((current_x + offset[0], y + offset[1]), clean_part, fill=color, font=font)
        else:
            # Normal text - apply base style if specified
            if bold:
                for offset in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                    draw.text((current_x + offset[0], y + offset[1]), part, fill=color, font=font)
            else:
                draw.text((current_x, y), part, fill=color, font=font)

        # Calculate width to advance x position
        try:
            bbox = font.getbbox(part[2:-2] if is_bold else part)
            part_width = bbox[2] - bbox[0]
            current_x += part_width
        except:
            # Fallback if getbbox fails
            current_x += len(part) * 10


def draw_rounded_rectangle(draw, xy, radius, fill, outline=None, width=1):
    """Draw a rounded rectangle"""
    x1, y1, x2, y2 = xy

    # Draw rounded corners
    draw.ellipse([x1, y1, x1 + radius * 2, y1 + radius * 2], fill=fill, outline=outline, width=width)
    draw.ellipse([x2 - radius * 2, y1, x2, y1 + radius * 2], fill=fill, outline=outline, width=width)
    draw.ellipse([x1, y2 - radius * 2, x1 + radius * 2, y2], fill=fill, outline=outline, width=width)
    draw.ellipse([x2 - radius * 2, y2 - radius * 2, x2, y2], fill=fill, outline=outline, width=width)

    # Draw rectangles to fill the gaps
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill, outline=outline, width=width)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill, outline=outline, width=width)


def generate_help_image(config):
    """Generate help menu image based on configuration"""

    # Get configuration values
    layout = config.get('layout', {})
    theme = config.get('theme', {})
    bot_info = config.get('bot_info', {})
    sections = config.get('sections', [])
    fonts_config = config.get('fonts', {})

    # Image dimensions
    items_per_row = layout.get('items_per_row', 3)
    card_width = layout.get('card_width', 200)
    card_height = layout.get('card_height', 80)
    padding = layout.get('padding', 20)
    spacing = layout.get('spacing', 15)

    # Calculate image size
    max_items = max([len(section.get('items', [])) for section in sections] + [0])
    rows_per_section = (max_items + items_per_row - 1) // items_per_row

    header_height = 200
    section_title_height = 60

    total_width = padding * 2 + (card_width + spacing) * items_per_row - spacing
    section_height = section_title_height + (card_height + spacing) * rows_per_section + spacing
    total_height = header_height + len(sections) * section_height + padding * 2

    # Create base image
    if theme.get('background_type') == 'gradient':
        gradient_colors = theme.get('background_gradient', ['#ffeef8', '#e6f3ff'])
        angle = theme.get('angle', 135)
        image = create_gradient_background(total_width, total_height, gradient_colors, angle)
    elif theme.get('background_type') == 'image' and theme.get('background_image'):
        try:
            bg_path = theme.get('background_image')
            image = Image.open(bg_path).resize((total_width, total_height))
        except:
            image = Image.new('RGB', (total_width, total_height), hex_to_rgb(theme.get('background_color', '#f5f5f5')))
    else:
        image = Image.new('RGB', (total_width, total_height), hex_to_rgb(theme.get('background_color', '#f5f5f5')))

    draw = ImageDraw.Draw(image)

    # Load fonts
    title_font = get_font(fonts_config.get('title_font'), fonts_config.get('title_size', 32))
    subtitle_font = get_font(fonts_config.get('content_font'), fonts_config.get('subtitle_size', 18))
    card_title_font = get_font(fonts_config.get('content_font'), fonts_config.get('card_title_size', 16))
    card_desc_font = get_font(fonts_config.get('content_font'), fonts_config.get('card_desc_size', 12))
    # Load emoji font for icons
    emoji_font = get_font(None, fonts_config.get('card_title_size', 16), emoji_support=True)

    # Draw header
    y_offset = padding

    # Draw avatar if exists
    avatar_path = bot_info.get('avatar', '')
    if avatar_path and os.path.exists(avatar_path):
        try:
            avatar = Image.open(avatar_path).resize((80, 80))
            # Create circular mask
            mask = Image.new('L', (80, 80), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.ellipse([0, 0, 80, 80], fill=255)
            image.paste(avatar, (padding, y_offset), mask)
        except Exception as e:
            print(f"Error loading avatar: {e}")

    # Draw logo if exists (in top-right corner)
    logo_path = bot_info.get('logo', '')
    if logo_path and os.path.exists(logo_path):
        try:
            logo_img = Image.open(logo_path).convert('RGBA')
            # Calculate size maintaining aspect ratio (max 80x80)
            max_size = 80
            logo_img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            logo_width, logo_height = logo_img.size
            # Position in top-right corner
            logo_x = total_width - padding - logo_width
            logo_y = padding
            image.paste(logo_img, (logo_x, logo_y), logo_img)
        except Exception as e:
            print(f"Error loading logo: {e}")

    # Draw bot info
    text_x = padding + 100
    bot_name = clean_markdown(bot_info.get('name', 'Bot'))
    draw_text_with_style(draw, (text_x, y_offset), bot_name, title_font, hex_to_rgb(theme.get('title_color', '#333333')),
                        bold=fonts_config.get('title_bold', False))

    y_offset += 40
    bot_qq = bot_info.get('qq', '')
    if bot_qq:
        draw_text_with_style(draw, (text_x, y_offset), f"QQ: {bot_qq}", subtitle_font, hex_to_rgb(theme.get('subtitle_color', '#666666')),
                            bold=fonts_config.get('content_bold', False))

    y_offset += 30
    description = bot_info.get('description', '')
    if description:
        draw_text_with_style(draw, (text_x, y_offset), description, card_desc_font, hex_to_rgb(theme.get('subtitle_color', '#666666')),
                            bold=fonts_config.get('content_bold', False))

    y_offset += 25
    notice = bot_info.get('notice', '')
    if notice:
        draw_text_with_style(draw, (text_x, y_offset), notice, card_desc_font, hex_to_rgb(theme.get('subtitle_color', '#666666')),
                            bold=fonts_config.get('content_bold', False))

    y_offset = header_height

    # Draw sections
    for section in sections:
        section_name = clean_markdown(section.get('name', ''))
        items = section.get('items', [])

        # Draw section title
        draw_text_with_style(draw, (padding, y_offset), section_name, subtitle_font, hex_to_rgb(theme.get('title_color', '#333333')),
                            bold=fonts_config.get('content_bold', False))
        y_offset += section_title_height

        # Draw items
        for idx, item in enumerate(items):
            row = idx // items_per_row
            col = idx % items_per_row

            x = padding + col * (card_width + spacing)
            y = y_offset + row * (card_height + spacing)

            # Draw card background
            card_bg = hex_to_rgb(theme.get('card_background', '#ffffff'))
            card_border = hex_to_rgb(theme.get('card_border', '#e0e0e0'))
            draw_rounded_rectangle(draw, [x, y, x + card_width, y + card_height], 10, fill=card_bg, outline=card_border, width=2)

            # Draw icon (if exists) - without background circle
            icon_text = item.get('icon', '')
            has_icon = bool(icon_text)

            if has_icon:
                # Icon should be vertically centered on the left side
                icon_x = x + 15
                icon_y = y + (card_height - 24) // 2  # Center the icon vertically
                try:
                    draw.text((icon_x, icon_y), icon_text, font=emoji_font,
                             fill=hex_to_rgb(theme.get('card_title_color', '#444444')))
                except Exception as e:
                    print(f"Icon rendering fallback: {e}")
                    draw.text((icon_x, icon_y), icon_text, font=card_desc_font,
                             fill=hex_to_rgb(theme.get('card_title_color', '#444444')))

            # Draw item name - positioned to the right of icon
            item_name = clean_markdown(item.get('name', ''))
            name_x = x + 50 if has_icon else x + 15
            name_y = y + 12
            draw_text_with_markdown(draw, (name_x, name_y), item_name, card_title_font, hex_to_rgb(theme.get('card_title_color', '#444444')),
                                   bold=fonts_config.get('content_bold', False))

            # Draw description - aligned with name
            item_desc = clean_markdown(item.get('description', ''))
            desc_x = x + 50 if has_icon else x + 15
            desc_y = y + 32
            draw_text_with_markdown(draw, (desc_x, desc_y), item_desc, card_desc_font, hex_to_rgb(theme.get('card_desc_color', '#888888')),
                                   bold=fonts_config.get('content_bold', False))

            # Draw usage if available
            item_usage = item.get('usage', '')
            if item_usage:
                usage_x = x + 50 if has_icon else x + 15
                usage_y = y + 51
                # Use smaller font for usage (0.85x of desc font)
                try:
                    usage_font_size = max(8, int(fonts_config.get('card_desc_size', 12) * 0.85))
                    usage_font = get_font(fonts_config.get('content_font', None), usage_font_size)
                except:
                    usage_font = card_desc_font

                # Draw with slightly lighter color
                desc_color = hex_to_rgb(theme.get('card_desc_color', '#888888'))
                usage_color = tuple(min(255, c + 25) for c in desc_color)
                usage_text = f"用法: {item_usage}"
                draw.text((usage_x, usage_y), usage_text, font=usage_font, fill=usage_color)

        y_offset += (card_height + spacing) * ((len(items) + items_per_row - 1) // items_per_row) + spacing

    # Draw corner badge if exists
    corner_badge = bot_info.get('corner_badge', '')
    if corner_badge:
        # Use smaller font for corner badge
        badge_font_size = min(fonts_config.get('card_desc_size', 12), 11)
        badge_font = get_font(fonts_config.get('content_font', None), badge_font_size)

        # Calculate badge dimensions
        try:
            bbox = badge_font.getbbox(corner_badge)
            badge_text_width = bbox[2] - bbox[0]
            badge_text_height = bbox[3] - bbox[1]
        except:
            badge_text_width = len(corner_badge) * badge_font_size * 0.6
            badge_text_height = badge_font_size

        # Badge padding
        badge_padding_x = 12
        badge_padding_y = 6
        badge_width = badge_text_width + badge_padding_x * 2
        badge_height = badge_text_height + badge_padding_y * 2

        # Position in top-right corner (8px from edges)
        badge_x = total_width - 8 - badge_width
        badge_y = 8

        # Draw badge background (semi-transparent white)
        badge_bg = Image.new('RGBA', (int(badge_width), int(badge_height)), (255, 255, 255, 230))

        # Convert main image to RGBA if needed to support transparency
        if image.mode != 'RGBA':
            image = image.convert('RGBA')

        # Paste badge background with transparency
        image.paste(badge_bg, (int(badge_x), int(badge_y)), badge_bg)

        # Re-create draw object after conversion
        draw = ImageDraw.Draw(image)

        # Draw badge text
        text_x = badge_x + badge_padding_x
        text_y = badge_y + badge_padding_y
        subtitle_color = hex_to_rgb(theme.get('subtitle_color', '#666666'))
        draw_text_with_markdown(draw, (text_x, text_y), corner_badge, badge_font, subtitle_color,
                               bold=fonts_config.get('content_bold', False))

    # Convert back to RGB if it was converted to RGBA
    if image.mode == 'RGBA':
        rgb_image = Image.new('RGB', image.size, (255, 255, 255))
        rgb_image.paste(image, mask=image.split()[3])
        image = rgb_image

    return image


# Routes
@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404
    return send_file(filepath)


@app.route('/fonts/<path:filename>')
def font_file(filename):
    """Serve font files"""
    return send_file(os.path.join(app.config['FONT_FOLDER'], filename))


@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration"""
    config = load_config()
    if config:
        return jsonify({'success': True, 'config': config})
    return jsonify({'success': False, 'error': 'Failed to load config'})


@app.route('/api/config', methods=['POST'])
def update_config():
    """Update configuration"""
    try:
        config = request.json
        if save_config(config):
            return jsonify({'success': True})
        return jsonify({'success': False, 'error': 'Failed to save config'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/generate', methods=['POST'])
def generate_image():
    """Generate help menu image"""
    try:
        config = load_config()
        if not config:
            return jsonify({'success': False, 'error': 'Failed to load config'})

        print("Generating image...")
        image = generate_help_image(config)

        # Save image
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], f'help_menu_{timestamp}.png')
        image.save(output_path, 'PNG')
        print(f"Image saved to: {output_path}")

        # Convert to base64 for preview
        buffered = io.BytesIO()
        image.save(buffered, format='PNG')
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_str}',
            'path': output_path
        })
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error generating image: {error_details}")
        return jsonify({'success': False, 'error': str(e)})




@app.route('/api/upload/<file_type>', methods=['POST'])
def upload_file(file_type):
    """Upload files (avatar, logo, font, background)"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'})

        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'})

        # Determine upload folder
        if file_type == 'font':
            folder = app.config['FONT_FOLDER']
        else:
            folder = app.config['UPLOAD_FOLDER']

        # Save file
        filename = file.filename
        filepath = os.path.join(folder, filename)
        file.save(filepath)

        return jsonify({
            'success': True,
            'path': filepath,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/fonts', methods=['GET'])
def list_fonts():
    """List available fonts"""
    try:
        fonts = []
        if os.path.exists(app.config['FONT_FOLDER']):
            fonts = [f for f in os.listdir(app.config['FONT_FOLDER']) if f.endswith('.ttf') or f.endswith('.otf')]
        return jsonify({'success': True, 'fonts': ['default'] + fonts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/themes', methods=['GET'])
def list_themes():
    """List preset themes"""
    return jsonify({'success': True, 'themes': PRESET_THEMES})


@app.route('/api/apply-theme/<theme_name>', methods=['POST'])
def apply_theme(theme_name):
    """Apply a preset theme"""
    try:
        if theme_name not in PRESET_THEMES:
            return jsonify({'success': False, 'error': 'Theme not found'})

        config = load_config()
        if not config:
            return jsonify({'success': False, 'error': 'Failed to load config'})

        # Update theme settings
        theme_data = PRESET_THEMES[theme_name]
        if 'theme' not in config:
            config['theme'] = {}

        config['theme'].update({
            'name': theme_name,
            'background_type': 'gradient',
            'background_gradient': theme_data['background_gradient'],
            'angle': theme_data.get('angle', 135),
            'card_background': theme_data['card_background'],
            'card_border': theme_data['card_border'],
            'title_color': theme_data['title_color'],
            'subtitle_color': theme_data['subtitle_color'],
            'card_title_color': theme_data['title_color'],
            'card_desc_color': theme_data['subtitle_color'],
        })

        if save_config(config):
            return jsonify({'success': True, 'config': config})
        return jsonify({'success': False, 'error': 'Failed to save config'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


if __name__ == '__main__':
    # Load config on startup
    load_config()

    print("=" * 50)
    print("QQ Bot Help Menu Generator")
    print("=" * 50)
    print("Server starting on http://localhost:5000")
    print("Press Ctrl+C to quit")
    print("=" * 50)

    app.run(debug=True, host='0.0.0.0', port=5000)
