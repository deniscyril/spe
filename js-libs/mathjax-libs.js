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


function mathJaxUpdate(){
  jsLogger('[MathJax] - Page formatting')

  window.MathJax.startup.output.clearCache()
  window.MathJax.typesetClear()
  window.MathJax.texReset()
  window.MathJax.typesetPromise()
}
const mathJaxIsReady = subscribeWhenReady('mathJax', mathJaxUpdate)


window.MathJax = {
  startup: {
    ready: () => {
      jsLogger("[MathJax] - Setting up");
      MathJax.startup.defaultReady();
      jsLogger("[MathJax] - Ready");
      mathJaxIsReady()
      mathJaxUpdate()
    },
  },
  loader: {load: ['[tex]/cancel']},
  tex: {
    packages: {'[+]': ['cancel']},
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true,
  },
  options: {
    ignoreHtmlClass: ".*|",
    processHtmlClass: "arithmatex",
  },
};
