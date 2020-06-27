import { init } from "snabbdom";
import { VNode } from "snabbdom/vnode";
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';

const patch = init([klass, attributes, properties, listeners]);

import { h } from 'snabbdom/h';
import { toVNode } from 'snabbdom/tovnode';

import { boardSettings } from './board';
import { variants } from './chess';
import { _, LANGUAGES } from './i18n';
import { sound } from './sound';

function settingsButton() {
    return h('button#btn-settings', { on: { click: toggleSettings } }, [
        h('div.icon.icon-cog') //, { class: { icon: true, "icon-cog": true } })
    ]);
}

function userMenu() {
    return h('div#user-buttons', [
        h('a.login.nav-link', { on: { click: logoutDialog } }, _("Log out")),
    ]);
}

function logoutDialog() {
    if (confirm(_("Are you sure you want to log out?")))
        window.location.href = "/logout";
}

function settingsMenu() {
    return h('div#settings-buttons', [
        h('button#btn-lang', { on: { click: () => showSettings('lang') } }, 'Language'),
        h('button#btn-sound', { on: { click: () => showSettings('sound') } }, _('Sound')),
        h('button#btn-background', { on: { click: () => showSettings('background') } }, _('Background')),
        h('button#btn-board', { on: { click: () => showSettings('board') } }, _('Board Settings')),
    ]);
}

export function settingsView() {
    const anon = document.getElementById('pychess-variants')!.getAttribute("data-anon");
    console.log(anon);
    const menu = (anon === 'True') ? [ settingsMenu() ] : [ userMenu(), settingsMenu() ];
    return h('div#settings-panel', [
        settingsButton(),
        h('div#settings', [
            h('div#settings-main', menu),
            h('div#settings-sub'),
        ])
    ]);
}

export function toggleSettings() {
    const settings = document.getElementById('settings') as HTMLElement;
    if (settings.style.display === 'flex') {
        settings.style.display = 'none';
    }
    else {
        settings.style.display = 'flex';
        (document.getElementById('settings-main') as HTMLElement).style.display = 'flex';
        (document.getElementById('settings-sub') as HTMLElement).style.display = 'none';
    }
}

function showSettings(settingsName) {
    const mainSettings = document.getElementById('settings-main') as HTMLElement;
    const subSettings = document.getElementById('settings-sub') as HTMLElement;

    switch (settingsName) {
        case "lang":
            patch(toVNode(subSettings), langSettingsView());
            break;
        case "sound":
            patch(toVNode(subSettings), soundSettingsView());
            break;
        case "background":
            patch(toVNode(subSettings), backgroundSettingsView());
            break;
        case "board":
            patch(toVNode(subSettings), boardSettingsView());
            showVariantBoardSettings((document.getElementById('board-variant') as HTMLInputElement).value);
            break;
    }


    mainSettings.style.display = 'none';
    subSettings.style.display = 'flex';
}

function langSettingsView() {
    const currentLang = document.getElementById('pychess-variants')!.getAttribute("data-lang");
    console.log(currentLang);
    let langList: VNode[] = [];
    Object.keys(LANGUAGES).forEach(key => {
        langList.push(h('input#lang-' + key, {
            props: { type: "radio", name: "lang", value: key },
            attrs: { checked: currentLang === key },
            on: { change: e => (e.target as HTMLInputElement).form!.submit() },
        }));
        langList.push(h('label', { props: { for: "lang-" + key } }, LANGUAGES[key]));
    });
    return h('div#settings-sub', [
        h('div#settings-lang', [
            h('form.radio-list', { props: { method: "post", action: "/translation/select" } }, langList),
        ]),
    ]);
}

const soundThemes = [ 'Silent', 'Standard', 'Robot' ];
function soundSettingsView() {
    const currentVolume = parseFloat(localStorage.volume ?? '1');
    const currentSoundTheme = localStorage.soundTheme ?? 'standard';
    let soundThemeList: VNode[] = [];
    soundThemes.forEach(theme => {
        soundThemeList.push(h('input#sound-' + theme.toLowerCase(), {
            props: { name: "sound-theme", type: "radio"},
            attrs: { checked: currentSoundTheme === theme.toLowerCase() },
            on: { change: () => setSoundTheme(theme) }
        }));
        soundThemeList.push(h('label', { props: { for: "sound-" + theme.toLowerCase() } }, theme));
    });
    return h('div#settings-sub', [
        h('div#settings-sound', [
            h('input#sound-volume.slider.vertical', {
                props: { name: "volume", type: "range", min: 0, max: 1, step: 0.01, value: currentVolume },
                on: { change: e => setVolume((e.target as HTMLInputElement).value) },
            }),
            h('div#sound-theme.radio-list', soundThemeList),
        ])
    ]);
}

const backgrounds = [ 'Light', 'Dark' ];
function backgroundSettingsView() {
    const currentBackground = localStorage.theme ?? 'light';
    let backgroundList: VNode[] = [];
    backgrounds.forEach(theme => {
        backgroundList.push(h('input#background-' + theme.toLowerCase(), {
            props: { name: "background", type: "radio"},
            attrs: { checked: currentBackground === theme.toLowerCase() },
            on: { change: () => setBackground(theme) }
        }));
        backgroundList.push(h('label', { props: { for: "background-" + theme.toLowerCase() } }, theme));
    });
    return h('div#settings-sub', [
        h('div#settings-background', backgroundList),
    ]);
}

function boardSettingsView() {
    const variant = document.getElementById("pychess-variants")!.getAttribute("data-variant");
    let variantList: VNode[] = [];
    variantList.push(h('option', { props: { value: "" } }, ""));
    variants.forEach(v => {
        variantList.push(h('option', {
            props: { value: v },
            attrs: { selected: variant === v }
        }, v.toUpperCase()));
    });
    return h('div#settings-sub', [
        h('div#settings-board', [
            h('label', { props: { for: "board-variant" } }, _("Variant")),
            h('select#board-variant', { on: { change: e => showVariantBoardSettings((e.target as HTMLInputElement).value) } }, variantList),
            h('div#board-settings'),
        ]),
    ]);
}

function showVariantBoardSettings(variant) {
    const settings = document.getElementById('board-settings') as HTMLElement;
    patch(toVNode(settings), boardSettings.view(variant));
}

function setVolume(volume) {
    localStorage.volume = volume;
    sound.updateVolume();
}

function setSoundTheme(soundTheme) {
    localStorage.soundTheme = soundTheme.toLowerCase();
    sound.updateSoundTheme();
}

function setBackground(theme) {
    const oldTheme = document.documentElement.getAttribute('data-theme');
    localStorage.theme = theme.toLowerCase();
    updateBackground();
    if (oldTheme !== theme.toLowerCase()) {
        var alliside = document.getElementsByTagName('i-side');
        for (var j = 0; j < alliside.length; j++) {
            // take care of random color seek icons
            if (!alliside[j].classList.contains('icon-adjust')) {
                alliside[j].classList.toggle("icon-white");
                alliside[j].classList.toggle("icon-black");
            }
        }
    }
}

export function updateBackground() {
    const theme = localStorage.theme ?? 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

export function changeCSS(cssFile) {
    // css file index in template.html
    let cssLinkIndex = 1;
    if (cssFile.includes("seir")) {
        cssLinkIndex = 2;
    } else if (cssFile.includes("makruk")) {
        cssLinkIndex = 3;
    } else if (cssFile.includes("sittuyin")) {
        cssLinkIndex = 4;
    } else if (cssFile.includes("shogi")) {
        cssLinkIndex = 5;
    } else if (cssFile.includes("kyoto")) {
        cssLinkIndex = 6;
    } else if (cssFile.includes("xiangqi")) {
        cssLinkIndex = 7;
    } else if (cssFile.includes("capa")) {
        cssLinkIndex = 8;
    } else if (cssFile.includes("shako")) {
        cssLinkIndex = 9;
    } else if (cssFile.includes("shogun")) {
        cssLinkIndex = 10;
    } else if (cssFile.includes("janggi")) {
        cssLinkIndex = 11;
    } else if (cssFile.includes("orda")) {
        cssLinkIndex = 12;
    }
    document.getElementsByTagName("link").item(cssLinkIndex)!.setAttribute("href", cssFile);
}
