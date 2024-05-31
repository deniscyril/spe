/*
pyodide-mkdocs-theme
Copyleft GNU GPLv3 🄯 2024 Frédéric Zinelli

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.
If not, see <https://www.gnu.org/licenses/>.
*/


/*
NOTE: Globals defined somewhere else:

    * The "ace" variable is defined in the ace library. Everything using it must be called after
      the libs step insertions.
*/
const SqBs = {
    '[':'&lsqb;',
    ']':'&rsqb;',
    '&lsqb;': '[',
    '&rsqb;': ']',
    L: '&lsqb;',
    R: '&rsqb;',
}

const CONFIG = {

    /*
    The following values are passed from python to JS through the main.html,
    once this script got loaded */
    //JS_CONFIG_DUMP
    baseUrl: null,
    buttonIconsDirectory: null,
    deactivateStdoutForSecrets: null,
    decreaseAttemptsOnUserCodeFailure: null,
    defaultHeightIdeTerm: null,
    defaultHeightIsolatedTerm: null,
    defaultIdeHeightLines: null,
    docsDir: null,
    encryptCorrectionsAndRems: null,
    forbidCorrAnd_REMsWithInfiniteAttempts: null,
    forbidHiddenCorrAnd_REMsWithoutSecrets: null,
    forbidSecretsWithoutCorrOr_REMs: null,
    hide: null,
    ignoreMacrosPluginDiffs: null,
    j2BlockEndString: null,
    j2BlockStartString: null,
    j2VariableEndString: null,
    j2VariableStartString: null,
    loadYamlEncoding: null,
    macrosWithIndents: null,
    maxAttemptsBeforeCorrAvailable: null,
    multi: null,
    pmtUrl: null,
    pythonLibs: null,
    repoUrl: null,
    scriptsUrl: null,
    showAssertionCodeOnFailedTest: null,
    showOnlyAssertionErrorsForSecrets: null,
    shuffle: null,
    siteDir: null,
    siteName: null,
    siteRoot: null,
    siteUrl: null,
    skipPyMdPathsNamesValidation: null,
    stdoutCutOff: null,
    version: null,
    lang: {
        tests: null,
        comments: null,
        feedback: null,
        wrapTerm: null,
        runScript: null,
        installStart: null,
        installDone: null,
        successMsg: null,
        successHead: null,
        successTail: null,
        failHead: null,
        revealCorr: null,
        revealJoin: null,
        revealRem: null,
        successHeadExtra: null,
        failTail: null,
        titleCorr: null,
        titleRem: null,
        corr: null,
        rem: null,
        pyBtn: null,
        play: null,
        check: null,
        download: null,
        upload: null,
        restart: null,
        save: null,
        attemptsLeft: null,
        qcmTitle: null,
        qcmMaskTip: null,
        qcmCheckTip: null,
        qcmRedoTip: null,
        tipTrash: null
},
   //JS_CONFIG_DUMP


    /**Constant, to archive the terminals at runtime.
     *   - Will be garbage collected on page change or reload.
     *   - Warning if navigation.instant gets restored !!
     * */
    terms: {},                      // debugging purpose
    editors: {},                    // debugging purpose
    objs: {},                       // debugging purpose

    onDoneEvent : 'unload',         // unused, so far...
    pyodideDelay: 500,
    LZW: '\x1e',

    // Various UI elements identifiers
    element: {
        searchBlock:    "div.md-search",
        searchBtnsLeft:  "#search-btns-left",
        searchBtnsRight: "#search-btns-right",
        dayNight:       "form.md-header__option",
        stdoutCtrlId:   "#stdout-controller-btn",
        cutFeedbackSvg: "#cut-feedback-svg",
        hourGlass:      "#header-hourglass-svg",
        qcm_admos:      ".py_mk_admonition_qcm",
        qcmInnerDiv:    ".py_mk_admonition_qcm-inner",
        qcmCounterCls:  ".qcm-counter",
        qcmWrapper:     ".qcm_wrapper",
    },

    // Auto subscriber tracking:
    subscriptionReady: {},
    subscriptionsTries: {},

    loggerOptions: {},      // jsLogger debugging config/activations



    // (defined in the securedPagesData-libs.js file)
    // JS <-> python property names tracker

    cutFeedback: true,
    joinTerminalLines: false,

    // HDR_TOKEN_PATTERN:   /#\s*-[\s-]*HDR\s*-[\s-]*#/i,           // not used anymore
    COMMENTED_PATTERN:      /(^\s*)(\S)(.?)/,
    MODULE_REG:             /File "<(env|post|exec|console)>", line (\d+)($|, in (?!await_fut))/,
    TRACE_REG:              /  File "<(env|post|exec|console)>"/,
    TRACE_NUM_LINE:         /File "<(?:env|post|exec|console)>", line (\d+)/,

    ESCAPE_SQ_B:            /\[|\]/g,
    UNESCAPE_SQ_B:          new RegExp(`[${ SqBs.L }${ SqBs.R }]`, 'g'),

    ACE_COLOR_THEME: {
        customTheme: undefined,
        customThemeDefaultKey: "",
        aceStyle: undefined,
    },


    feedbackShortener: {
        // StdOut:
        limit: 1000,
        head: 400,
        tail: 200,
        msg: "&lsqb;Message truncated&rsqb;",

        // Terminal stacktrace:
        traceLimit: 20,
        traceHead: 5,
        traceTail: 5,

        // Error message:
        errLimit: 15,
        errHead: 6,
        errTail: 5,
    },


    MSG: {
        successEmojis:   ['🔥','✨','🌠','✅','🥇','🎖'],

        promptStart:     ">>> ",
        promptWait:      "... ",
        leftSafeSqbr:    SqBs.L,
        rightSafeSqbr:   SqBs.R,
        exclusionMarker: "FORBIDDEN",
        bigFail:         "\nIf You see this, there is a bug either in the website code, or in the way "
                       + "this exercice is configured.\nPlease contact the webmaster with information "
                       + "about what You were doing when this happened!\n\nDon't forget to check the "
                       + "content of the console (F12) and possibly make a screenshot of any message "
                       + "there, to help debugging.",
    },

}