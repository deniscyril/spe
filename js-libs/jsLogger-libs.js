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

/** The options can be modified at runtime on user's side, to ease debugging.
 * */
CONFIG.loggerOptions={
    ACTIVATE:           false,
    all:                false,

    AroundSearch:       false,
    Feature:            false,
    HourGlass:          false,
    LOCK:               false,
    MathJax:            false,
    Paint_ACEs:         false,
    QCM:                false,
    Scroll:             false,
    SetupIDEs:          false,
    SetupLoneTerms:     false,
    StdoutController:   false,
    Subscribing:        false,
    Terminal:           false,
    TrashCan:           false,
    Unsubscribing:      false,
}


const jsLogger=(...msgs)=>{
    if(!CONFIG.loggerOptions.ACTIVATE) return

    if(CONFIG.loggerOptions.all || msgs[0] && isLoggedOption(msgs[0])){
        console.log(...msgs)
    }
}

const isLoggedOption=(msg)=>{
    if(msg[0]!='[') throw new Error(
        `Invalid jsLogger usage: the first message should always start with "[".\nWas: ${msg}`
    )
    const head = msg.match(/^\[(\w+)/)
    return head && CONFIG.loggerOptions[head[1]]
}
