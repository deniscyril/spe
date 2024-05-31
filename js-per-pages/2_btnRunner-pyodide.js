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


class BtnRunner extends PyodideSectionsRunner {


  // @Override
  build(){
    $('#'+this.id).find("button").on('click', this.playFactory())
    super.build()
  }



  playFactory(){
    return withPyodideAsyncLock('playBtn', async(e)=>{
      jsLogger("[playBtn]")
      if(e && e.preventDefault) e.preventDefault()  // Useless for buttons, but keep it anyway...

      let {options, stdErr, _} = await this.setupRuntime()
      await this.teardownRuntime(options, stdErr, false)
    })
  }
}