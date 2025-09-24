<?php

/**
 * Plugin Name: GP Lofi Player
 * Description: Phục vụ trang Lofi tại /lofi-player
 * Author: GP Studio99
 */

if (!defined('ABSPATH')) exit;

class GP_Lofi_Standalone_Route
{
    const SLUG = 'lofi-player';
    const OPT_PLAYLIST   = 'gp_lofi_playlist';
    const OPT_NATURE     = 'gp_lofi_nature';
    const OPT_INSTRUMENT = 'gp_lofi_instrument';

    // Cấu hình cho phép thẻ SVG trong icon
    private function allowed_svg_html()
    {
        // Cho phép các thẻ/thuộc tính SVG thường dùng (không cho <script>)
        return [
            'svg' => [
                'xmlns' => true,
                'width' => true,
                'height' => true,
                'viewBox' => true,
                'fill' => true,
                'stroke' => true,
                'stroke-width' => true,
                'stroke-linecap' => true,
                'stroke-linejoin' => true,
                'class' => true,
                'style' => true,
                'aria-hidden' => true,
                'role' => true,
                'defs'     => ['class' => true, 'style' => true],
                'use'      => ['href' => true, 'xlink:href' => true, 'class' => true, 'style' => true],
                'clipPath' => ['id' => true, 'class' => true, 'style' => true],
                'ellipse'  => ['cx' => true, 'cy' => true, 'rx' => true, 'ry' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
                'title'    => ['class' => true, 'style' => true],
                'desc'     => ['class' => true, 'style' => true],
            ],
            'path'   => ['d' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true, 'class' => true, 'style' => true],
            'circle' => ['cx' => true, 'cy' => true, 'r' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
            'rect'   => ['x' => true, 'y' => true, 'width' => true, 'height' => true, 'rx' => true, 'ry' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
            'line'   => ['x1' => true, 'y1' => true, 'x2' => true, 'y2' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
            'polyline' => ['points' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
            'polygon' => ['points' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
            'g'      => ['fill' => true, 'stroke' => true, 'stroke-width' => true, 'class' => true, 'style' => true],
        ];
    }


    public function __construct()
    {
        // Route tĩnh cho trang player
        add_action('init', [$this, 'add_rewrite_rule']);
        add_action('template_redirect', [$this, 'render_lofi_if_matched']);
        add_filter('show_admin_bar', [$this, 'maybe_hide_admin_bar']);

        // Admin
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_post_gp_lofi_save', [$this, 'handle_save']);

        // REST config cho JS
        add_action('rest_api_init', [$this, 'register_rest_routes']);

        // Activate/Deactivate
        register_activation_hook(__FILE__, [__CLASS__, 'activate']);
        register_deactivation_hook(__FILE__, [__CLASS__, 'deactivate']);

        // Admin assets
        add_action('admin_enqueue_scripts', [$this, 'admin_assets']);
    }

    /* ---------- ROUTE /lofi-player ---------- */
    public function add_rewrite_rule()
    {
        add_rewrite_rule('^' . self::SLUG . '/?$', 'index.php?' . self::SLUG . '=1', 'top');
        add_rewrite_tag('%' . self::SLUG . '%', '1');
    }

    public function render_lofi_if_matched()
    {
        if (get_query_var(self::SLUG) !== '1') return;
        nocache_headers();

        $html_file = plugin_dir_path(__FILE__) . 'templates/lofi.html';
        $css_url   = plugin_dir_url(__FILE__) . 'assets/style.css';
        $js_url    = plugin_dir_url(__FILE__) . 'assets/lofi.js';

        if (!file_exists($html_file)) {
            status_header(500);
            wp_die('Thiếu templates/lofi.html');
        }

        $html = file_get_contents($html_file);

        // Inject CSS before </head>
        $cssTag = "\n<link rel=\"stylesheet\" href=\"" . esc_url($css_url) . "\" />\n";
        if (stripos($html, '</head>') !== false) {
            $html = preg_replace('/<\/head>/', $cssTag . '</head>', $html, 1);
        } else {
            // Fallback: prepend if no head (unlikely)
            $html = $cssTag . $html;
        }

        // Inject JS before </body>
        $jsTag = "\n<script src=\"" . esc_url($js_url) . "\"></script>\n";
        if (stripos($html, '</body>') !== false) {
            $html = preg_replace('/<\/body>\s*<\/html>\s*$/i', $jsTag . '</body></html>', $html);
        } else {
            $html .= $jsTag;
        }

        header('Content-Type: text/html; charset=UTF-8');
        echo $html;
        exit;
    }


    public static function activate()
    {
        (new self())->add_rewrite_rule();
        flush_rewrite_rules();
        // Tạo option trống nếu chưa có
        add_option(self::OPT_PLAYLIST, []);
        add_option(self::OPT_NATURE, []);
        add_option(self::OPT_INSTRUMENT, []);
    }
    public static function deactivate()
    {
        flush_rewrite_rules();
    }

    public function maybe_hide_admin_bar($show)
    {
        if (get_query_var(self::SLUG) === '1') return false;
        return $show;
    }

    /* ---------- ADMIN UI ---------- */
    public function add_admin_menu()
    {
        add_menu_page(
            'GP Lofi Player',
            'GP Lofi Player',
            'manage_options',
            'gp-lofi-player',
            [$this, 'render_admin_page'],
            'dashicons-format-audio',
            65
        );
    }

    public function admin_assets($hook)
    {
        if ($hook !== 'toplevel_page_gp-lofi-player') return;
        wp_enqueue_style('gp-lofi-admin', plugin_dir_url(__FILE__) . 'assets/admin.css', [], '1.0');
        wp_enqueue_script('gp-lofi-admin', plugin_dir_url(__FILE__) . 'assets/admin.js', ['jquery'], '1.0', true);
    }

    public function render_admin_page()
    {
        if (!current_user_can('manage_options')) return;
        $playlist   = get_option(self::OPT_PLAYLIST, []);
        $nature     = get_option(self::OPT_NATURE, []);
        $instrument = get_option(self::OPT_INSTRUMENT, []);
?>
        <div class="wrap">
            <h1>GP Lofi Player – Cấu hình</h1>
            <p>Trang phát: <code><?php echo esc_html(home_url('/' . self::SLUG)); ?></code></p>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('gp_lofi_save', '_gp_nonce'); ?>
                <input type="hidden" name="action" value="gp_lofi_save">

                <h2>Playlist (Bài hát)</h2>
                <table class="widefat striped" id="gp-table-playlist">
                    <thead>
                        <tr>
                            <th>Tiêu đề</th>
                            <th>Nghệ sĩ</th>
                            <th>Audio URL</th>
                            <th>Cover URL</th>
                            <th style="width:60px">Xóa</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($playlist)) : foreach ($playlist as $i => $row): ?>
                                <tr>
                                    <td><input type="text" name="playlist[<?php echo $i; ?>][title]" value="<?php echo esc_attr($row['title'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="text" name="playlist[<?php echo $i; ?>][artist]" value="<?php echo esc_attr($row['artist'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="url" name="playlist[<?php echo $i; ?>][src]" value="<?php echo esc_url($row['src'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="url" name="playlist[<?php echo $i; ?>][cover]" value="<?php echo esc_url($row['cover'] ?? ''); ?>" class="regular-text"></td>
                                    <td><button type="button" class="button link-delete-row">X</button></td>
                                </tr>
                        <?php endforeach;
                        endif; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button button-secondary" id="btn-add-playlist">+ Thêm bài hát</button></p>

                <hr>

                <h2>Âm thanh nền (Nature)</h2>
                <table class="widefat striped" id="gp-table-nature">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tên hiển thị</th>
                            <th>Audio URL</th>
                            <th>Icon SVG (inline)</th>
                            <th style="width:60px">Xóa</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($nature)) : foreach ($nature as $i => $row): ?>
                                <tr>
                                    <td><input type="text" name="nature[<?php echo $i; ?>][id]" value="<?php echo esc_attr($row['id'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="text" name="nature[<?php echo $i; ?>][name]" value="<?php echo esc_attr($row['name'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="url" name="nature[<?php echo $i; ?>][src]" value="<?php echo esc_url($row['src'] ?? ''); ?>" class="regular-text"></td>
                                    <td><textarea name="nature[<?php echo $i; ?>][icon]" rows="3" class="large-text code"><?php echo esc_textarea($row['icon'] ?? ''); ?></textarea></td>
                                    <td><button type="button" class="button link-delete-row">X</button></td>
                                </tr>
                        <?php endforeach;
                        endif; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button button-secondary" id="btn-add-nature">+ Thêm âm thanh nền</button></p>

                <hr>

                <h2>Nhạc cụ (Instrument)</h2>
                <table class="widefat striped" id="gp-table-instrument">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tên hiển thị</th>
                            <th>Audio URL</th>
                            <th>Icon SVG (inline)</th>
                            <th style="width:60px">Xóa</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($instrument)) : foreach ($instrument as $i => $row): ?>
                                <tr>
                                    <td><input type="text" name="instrument[<?php echo $i; ?>][id]" value="<?php echo esc_attr($row['id'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="text" name="instrument[<?php echo $i; ?>][name]" value="<?php echo esc_attr($row['name'] ?? ''); ?>" class="regular-text"></td>
                                    <td><input type="url" name="instrument[<?php echo $i; ?>][src]" value="<?php echo esc_url($row['src'] ?? ''); ?>" class="regular-text"></td>
                                    <td><textarea name="instrument[<?php echo $i; ?>][icon]" rows="3" class="large-text code"><?php echo esc_textarea($row['icon'] ?? ''); ?></textarea></td>
                                    <td><button type="button" class="button link-delete-row">X</button></td>
                                </tr>
                        <?php endforeach;
                        endif; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button button-secondary" id="btn-add-instrument">+ Thêm nhạc cụ</button></p>

                <p><button type="submit" class="button button-primary">Lưu cấu hình</button></p>
            </form>
        </div>
<?php
    }

    public function handle_save()
    {
        if (!current_user_can('manage_options')) wp_die('No permission');
        check_admin_referer('gp_lofi_save', '_gp_nonce');

        // Nhận và lọc dữ liệu
        $playlist   = isset($_POST['playlist'])   ? (array) $_POST['playlist']   : [];
        $nature     = isset($_POST['nature'])     ? (array) $_POST['nature']     : [];
        $instrument = isset($_POST['instrument']) ? (array) $_POST['instrument'] : [];

        $playlist = array_values(array_filter(array_map(function ($row) {
            return [
                'title'  => sanitize_text_field($row['title']  ?? ''),
                'artist' => sanitize_text_field($row['artist'] ?? ''),
                'src'    => esc_url_raw($row['src'] ?? ''),
                'cover'  => esc_url_raw($row['cover'] ?? '')
            ];
        }, $playlist), function ($r) {
            return !empty($r['src']) || !empty($r['title']);
        }));

        $nature = array_values(array_filter(array_map(function ($row) {
            return [
                'id'   => sanitize_key($row['id'] ?? ''),
                'name' => sanitize_text_field($row['name'] ?? ''),
                'src'  => esc_url_raw($row['src'] ?? ''),
                // DÙNG wp_kses + whitelist SVG, KHÔNG dùng wp_kses_post
                'icon' => wp_kses($row['icon'] ?? '', $this->allowed_svg_html()),
            ];
        }, $nature), function ($r) {
            return !empty($r['id']);
        }));

        $instrument = array_values(array_filter(array_map(function ($row) {
            return [
                'id'   => sanitize_key($row['id'] ?? ''),
                'name' => sanitize_text_field($row['name'] ?? ''),
                'src'  => esc_url_raw($row['src'] ?? ''),
                // DÙNG wp_kses + whitelist SVG, KHÔNG dùng wp_kses_post
                'icon' => wp_kses($row['icon'] ?? '', $this->allowed_svg_html()),
            ];
        }, $instrument), function ($r) {
            return !empty($r['id']);
        }));


        update_option(self::OPT_PLAYLIST, $playlist);
        update_option(self::OPT_NATURE, $nature);
        update_option(self::OPT_INSTRUMENT, $instrument);

        wp_redirect(add_query_arg(['page' => 'gp-lofi-player', 'updated' => '1'], admin_url('admin.php')));
        exit;
    }

    /* ---------- REST: /wp-json/gp-lofi/v1/config ---------- */
    public function register_rest_routes()
    {
        register_rest_route('gp-lofi/v1', '/config', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true', // public đọc cấu hình
            'callback' => function () {
                $playlist   = get_option(self::OPT_PLAYLIST, []);
                $nature     = get_option(self::OPT_NATURE, []);
                $instrument = get_option(self::OPT_INSTRUMENT, []);

                // Fallback demo nếu admin chưa cấu hình gì
                if (empty($playlist)) {
                    $playlist = [
                        ['title' => 'Giai điệu của Gió', 'artist' => 'Nghệ sĩ A', 'src' => '', 'cover' => ''],
                        ['title' => 'Dòng chảy Yên bình', 'artist' => 'Nghệ sĩ B', 'src' => '', 'cover' => ''],
                    ];
                }
                if (empty($nature)) {
                    $nature = [
                        ['id' => 'rain', 'name' => 'Mưa', 'src' => '', 'icon' => ''],
                        ['id' => 'wind', 'name' => 'Gió', 'src' => '', 'icon' => ''],
                    ];
                }
                if (empty($instrument)) {
                    $instrument = [
                        ['id' => 'piano', 'name' => 'Piano', 'src' => '', 'icon' => ''],
                        ['id' => 'guitar', 'name' => 'Guitar', 'src' => '', 'icon' => ''],
                    ];
                }

                return rest_ensure_response([
                    'playlist'   => $playlist,
                    'nature'     => $nature,
                    'instrument' => $instrument,
                ]);
            }
        ]);
    }
}

new GP_Lofi_Standalone_Route();
