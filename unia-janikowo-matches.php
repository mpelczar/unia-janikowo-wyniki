<?php
/**
 * Plugin Name: Unia Janikowo – Wyniki Meczów
 * Description: Wyświetla wyniki i terminarz MKS Janikowo pobierane z GitHub.
 * Version: 2.0
 * Author: Unia Janikowo
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ─── WAŻNE: wpisz tu swoją nazwę użytkownika i repo GitHub ───────────────────
// Przykład: jeśli repo to github.com/jankowalski/unia-janikowo-wyniki
// to wpisz: jankowalski/unia-janikowo-wyniki
define( 'UNIA_GITHUB_REPO', 'TWOJA_NAZWA/TWOJE_REPO' );

define( 'UNIA_JSON_URL',
    'https://raw.githubusercontent.com/' . UNIA_GITHUB_REPO . '/main/data/matches.json'
);
define( 'UNIA_CACHE_SECONDS', 3600 ); // odświeżaj co 1 godzinę

// ─── REST API endpoint ────────────────────────────────────────────────────────
add_action( 'rest_api_init', function () {
    register_rest_route( 'unia/v1', '/matches', [
        'methods'             => 'GET',
        'callback'            => 'unia_get_matches',
        'permission_callback' => '__return_true',
    ]);
});

function unia_get_matches(): WP_REST_Response {
    $cached = get_transient( 'unia_matches_cache' );
    if ( $cached !== false ) {
        return new WP_REST_Response( $cached, 200 );
    }

    $response = wp_remote_get( UNIA_JSON_URL, [ 'timeout' => 10 ] );

    if ( is_wp_error( $response ) ) {
        return new WP_REST_Response( [ 'error' => $response->get_error_message() ], 500 );
    }

    $body = wp_remote_retrieve_body( $response );
    $data = json_decode( $body, true );

    if ( ! is_array( $data ) ) {
        return new WP_REST_Response( [ 'error' => 'Błąd pobierania danych z GitHub' ], 500 );
    }

    set_transient( 'unia_matches_cache', $data, UNIA_CACHE_SECONDS );
    return new WP_REST_Response( $data, 200 );
}

// ─── Shortcode [unia_mecze] ────────────────────────────────────────────────────
add_shortcode( 'unia_mecze', function( $atts ) {
    $atts = shortcode_atts([
        'typ'   => 'oba',   // rozegrane | planowane | oba
        'limit' => '5',
    ], $atts );

    $api_url = esc_js( rest_url('unia/v1/matches') );
    $typ     = esc_attr( $atts['typ'] );
    $limit   = intval( $atts['limit'] );

    ob_start(); ?>
<div id="unia-mecze-widget">
    <div class="unia-loading">Ładowanie wyników…</div>
</div>
<style>
#unia-mecze-widget {
    font-family: inherit;
    max-width: 700px;
}
.unia-loading { color: #888; font-size: 14px; padding: 16px 0; }
.unia-error   { color: #c00; font-size: 13px; padding: 12px 0; }

.unia-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #999;
    margin: 28px 0 8px;
    padding-bottom: 8px;
    border-bottom: 2px solid #ececec;
}
.unia-match {
    display: grid;
    grid-template-columns: 76px 1fr auto 1fr 56px;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid #f3f3f3;
}
.unia-match:last-child { border-bottom: none; }

.unia-date {
    font-size: 11px;
    color: #aaa;
    white-space: nowrap;
}
.unia-home { font-size: 13px; font-weight: 600; text-align: right; }
.unia-away { font-size: 13px; font-weight: 600; text-align: left; }
.unia-home.bold, .unia-away.bold { color: #e63939; }

.unia-score {
    font-size: 15px;
    font-weight: 800;
    text-align: center;
    background: #111;
    color: #fff;
    border-radius: 4px;
    padding: 3px 10px;
    white-space: nowrap;
    min-width: 48px;
}
.unia-score.upcoming {
    background: #f0f0f0;
    color: #666;
    font-size: 12px;
    font-weight: 600;
}
.unia-updated {
    font-size: 11px;
    color: #bbb;
    margin-top: 16px;
}
</style>
<script>
(function () {
    var widget = document.getElementById('unia-mecze-widget');
    var typ    = '<?php echo $typ; ?>';
    var limit  = <?php echo $limit; ?>;
    var KLUB   = 'MKS Janikowo';

    function fmtDate(str) {
        if (!str) return '';
        var d = new Date(str);
        return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function isKlub(name) {
        return name && name.toLowerCase().includes('janikowo');
    }

    function renderMatch(m, played) {
        var homeBold = isKlub(m.home) ? ' bold' : '';
        var awayBold = isKlub(m.away) ? ' bold' : '';
        var scoreHtml = played
            ? '<span class="unia-score">' + (m.homeGoals ?? '?') + ' : ' + (m.awayGoals ?? '?') + '</span>'
            : '<span class="unia-score upcoming">' + (m.time || '—') + '</span>';
        return '<div class="unia-match">'
            + '<span class="unia-date">' + fmtDate(m.date) + '</span>'
            + '<span class="unia-home' + homeBold + '">' + (m.home || '?') + '</span>'
            + scoreHtml
            + '<span class="unia-away' + awayBold + '">' + (m.away || '?') + '</span>'
            + '</div>';
    }

    function renderSection(title, matches, played) {
        if (!matches || !matches.length) return '<p class="unia-error">Brak danych.</p>';
        var html = '<div class="unia-section-title">' + title + '</div>';
        matches.slice(0, limit).forEach(function (m) { html += renderMatch(m, played); });
        return html;
    }

    fetch('<?php echo $api_url; ?>')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.error) throw new Error(data.error);
            var html = '';
            if (typ === 'planowane' || typ === 'oba') {
                html += renderSection('Planowane mecze', data.upcoming, false);
            }
            if (typ === 'rozegrane' || typ === 'oba') {
                html += renderSection('Rozegrane mecze', data.played, true);
            }
            var updated = data.updatedAt
                ? '<div class="unia-updated">Ostatnia aktualizacja: ' + new Date(data.updatedAt).toLocaleString('pl-PL') + '</div>'
                : '';
            widget.innerHTML = html + updated;
        })
        .catch(function (e) {
            widget.innerHTML = '<div class="unia-error">Błąd: ' + e.message + '</div>';
        });
})();
</script>
<?php
    return ob_get_clean();
});
