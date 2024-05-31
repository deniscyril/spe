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



class _IdeEditorHandler extends TerminalRunner {

  constructor(editorId){
    super(editorId)
    this.termId     = "term_" + editorId
    this.editor     = null
    this.commentIdH = "#comment_" + editorId
    this.globalIdH  = "#global_" + editorId
    this.inputIdH   = "#input_" + editorId
    this.counterH   = "#compteur_" + editorId
    this.maxIdeSize = 0
    this.isV        = false
    this.resized    = true
    this.corrHidden = true
    this.editorCode = ""
  }



  // @Override
  build(){
    const ideThis   = this
    const editorDiv = $('#'+this.id)
    this.maxIdeSize = editorDiv.attr('max_size')
    this.isV        = editorDiv.attr('is_v')=='true'
    if(this.isV) this.resized = false

    this.setupAceEditor()           // Create and define this.editor

    // Bind the ### "button":
    $(this.commentIdH).on("click", this.toggleComments.bind(this))

    // Bind the input file, for downloads:
    const uploadInput = $(this.inputIdH)

    document  // Note: doesn't want to work with jQuery... Dunno why
      .getElementById(this.inputIdH.slice(1))
      .addEventListener( "change", function(changeEvent){
        let reader = new FileReader();
        reader.onload = function(event){
          ideThis.editor.getSession().setValue(event.target.result);
        };
        let file = changeEvent.target.files[0];
        reader.readAsText(file);
        ideThis.focusEditor()
      },
      false
    )

    // Bind all buttons below the IDE
    $(this.globalIdH).find("button").each(function(){
      const btn  = $(this)
      const kind = btn.attr('btn_kind')
      let callback
      switch(kind){
        case 'play':      callback = ideThis.playFactory() ; break
        case 'validate':  callback = ideThis.validateFactory() ; break

        case 'download':  callback = _=>ideThis.download() ; break
        case 'upload':    callback = _=>uploadInput.click() ; break

        case 'restart':   callback = _=>ideThis.restart() ; break
        case 'save':      callback = _=>{ideThis.save(); ideThis.focusEditor()} ; break

        default: throw new Error(`Y'should never get there, mate... (${ kind })`)
      }
      btn.on('click', callback)
    })


    // Build the related terminal and add the resize listener, because of the intermediate
    // wrapper div, terminals would not resize automatically
    super.build(this.termId)
    this.addResizer()


    // Then extract its current height and enforce the value on the terminal if isV is true.
    // This has to be done on "next tick" (not enough anymore => wait... a lot) and after creation
    // of the terminal instance, so that the editor height has been actually applied.
    if(this.isV){
      // Resize on next tick, once the editor has been filled:
      setTimeout(_=>this.resizeVerticalTerm(false))

      // in case an IDEv is tabbed, it won't scale properly because the editor is not handled
      // the same way, so put in place a "run once" click event, to resize it when the user
      // clicks on the _parent_ div (because the terminal itself is 0px high! XD )
      this.addEventToRunOnce(this.terminal.parent(), 'click', _=>this.resizeVerticalTerm())
    }
  }




  resizeVerticalTerm(mark=true){
    if(!this.isV || this.resized) return

    const divHeight = $('#'+this.id).css('height')
    const term_div = $(`${ this.globalIdH } .term_editor_v`)
    term_div.css("height", divHeight)
    this.resized = mark
  }



  /**Create and setup the ACE editor for the current Ide instance.
   * */
  setupAceEditor() {

    // https://github.com/ajaxorg/ace/blob/092b70c9e35f1b7aeb927925d89cb0264480d409/lib/ace/autocomplete.js#L545
    const options = {
        autoScrollEditorIntoView: false,
        copyWithEmptySelection: true,       // active alt+flèches pour déplacer une ligne, aussi
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: false,
        enableSnippets: true,
        tabSize: 4,
        useSoftTabs: true,                  // 4 spaces instead of tabs
        navigateWithinSoftTabs: false,      // this _fucking_ actually "Atomic Soft Tabs"...
        printMargin: false,                 // hide ugly margins...
        maxLines: this.maxIdeSize,
        minLines: this.isV ? this.maxIdeSize : 6,
        mode: "ace/mode/python",
        theme: getTheme(),
    }

    const editor = ace.edit(this.id, options);
    this.editor = editor
    if(CONFIG._devMode) CONFIG.editors[this.id] = editor

    editor.commands.bindKey(
        { win: "Ctrl-Space", mac: "Cmd-Space" }, "startAutocomplete"
    )
    editor.commands.addCommand({
        name: "commentTests",
        bindKey: { win: "Ctrl-I", mac: "Cmd-I" },
        exec: this.toggleComments.bind(this),
    })
    editor.commands.addCommand({
        name: "runPublicTests",
        bindKey: { win: "Ctrl-S", mac: "Cmd-S" },
        exec: this.playFactory(),
    })
    if(this.hasCheckBtn){
        editor.commands.addCommand({
        name: "runValidationTests",
        bindKey: { win: "Ctrl-Enter", mac: "Cmd-Enter" },
        exec: this.validateFactory(),
      })
    }

    // Editor content is saved every 30 keystrokes
    let nChange = 0;
    this.editor.addEventListener("input", _=>{
        if(nChange++ >= 30){
          nChange=0
          this.save()
        }
    })

    // Try to restore a previous session, or extract default starting code:
    let exerciseCode = this.getStartCode(true)
    this.applyCodeToEditorAndSave(exerciseCode)
    this.editor.resize();
  }



  // @Override
  getTerminalBindings(){

    // Ensure the terminal is focused...!
    const asyncTermFocus=(cbk)=>async e=>{
      await cbk(e)
      this.editor.blur()
      this.terminal.focus()
    }
    return ({
      ...super.getTerminalBindings(),
      'CTRL+I': asyncTermFocus(this.toggleComments.bind(this)),    // false for event handling propagation
      'CTRL+S': asyncTermFocus(this.playFactory()),
      ...(this.hasCheckBtn ? {'CTRL+ENTER': asyncTermFocus(this.validateFactory())}:{}),
    })
  }



  /**Automatically gives the focus to the ACE editor with the given id
   * */
  focusEditor(){
    this.editor.focus()
  }


  /* Override */
  getCurrentEditorCode(){
    // Extract the user's full code (possibly with public tests):
    return this.editor.getSession().getValue();
  }


  /**Build (or extract if allowed) the initial code to put in the editor.
   * */
  getStartCode(extractFromLocaleStorage=false){
    let exerciseCode=""

    if(extractFromLocaleStorage){
      exerciseCode = localStorage.getItem(this.id) || ""
    }
    if(!exerciseCode){
      const joiner = CONFIG.lang.tests.msg
      exerciseCode = [this.userContent, this.publicTests].filter(Boolean).join(joiner)
    }

    // Enforce at least 2 lines, so that the prompt is always visible for IDEv
    exerciseCode = exerciseCode.replace(/\n+$/,'')
    if(!exerciseCode) exerciseCode = '\n'

    return exerciseCode+"\n"
  }


  /**Takes in the id string of an editor, or an ACE editor as first argument, and the
   * code string to apply to it, and:
   *      - set the editor content to that string
   *      - save the code to the localStorage
   * */
  applyCodeToEditorAndSave(exerciseCode){
    exerciseCode ||= "\n".repeat(6)
    this.editor.getSession().setValue(exerciseCode);
    this.save(exerciseCode)
  }



  //-------------------------------------------------------------------------



  /**Extract the current content of the given editor, explore it, and toggle all the lines
   * found after the `# Test` token.
   * Rules for toggling or not are:
   *      - leading spaces are ignored.
   *      - comment out if the first character is not "#".
   *      - if the first char is "#" and there is no spaces behind, uncomment.
   * */
  toggleComments(e) {
    if(e && e.preventDefault) e.preventDefault()

    const codeLines = this.getCurrentEditorCode().split('\n')
    const pattern   = CONFIG.lang.tests.as_pattern
    const iTestsToken = codeLines.findIndex(s=>pattern.test(s))

    /// No tests found:
    if(iTestsToken<0) return;

    const toggled = codeLines.slice(iTestsToken+1).map(s=>{
        return s.replace(CONFIG.COMMENTED_PATTERN, (_,spaces,head,tail)=>{
            if(head=='#' && tail!=' ') return spaces+tail
            if(head!='#') return spaces+'#'+head+tail
            return _
        })
    })
    codeLines.splice(iTestsToken+1, toggled.length, ...toggled)
    const repl = codeLines.join('\n')
    this.applyCodeToEditorAndSave(repl)
    this.focusEditor()
  }



  /**Download the current content of the editor to the download folder of the user.
   * */
  download(){           jsLogger("[Download]")

    let ideContent = this.getCurrentEditorCode() + "" // enforce stringification in any case
    let blob       = new Blob([ideContent], { type: "text/plain" })
    let link       = document.createElement("a")
    link.href      = URL.createObjectURL(blob)
    link.download  = this.pyName

    link.click()
    URL.revokeObjectURL(link.href)
    link.remove()

    this.focusEditor()
  }


  /**Reset the content of the editor to its initial content, and reset the localStorage for
   * this editor on the way.
   * */
  restart(){            jsLogger("[Restart]")

    const exerciseCode = this.getStartCode()
    this.applyCodeToEditorAndSave(exerciseCode)
    this.focusEditor()
  }



  /**Save the current IDE content of the user, or the given code, into the localStorage
  * of the navigator.
  * */
  save(givenCode=""){   jsLogger("[Save]")

    const currentCode = givenCode || this.getCurrentEditorCode()
    localStorage.setItem(this.id, currentCode);
  }

  play(){  throw new Error("Should be overridden in child class") }
  check(){ throw new Error("Should be overridden in child class") }
}


















class IdeRunner extends _IdeEditorHandler {



  /**The terminal behaves differently when IDE content is run, so must be handled from here.
   * (mostly: through command lines, the terminal content is not cleared).
   *
   *  - If not paused, the terminal automatically display a new line for a fresh command.
   *  - So clear content only after if got paused.
   *  - Then show to the user that executions started and enforce terminal GUI refresh,
   *    with a tiny pause so that the user has time to see the "cleared" terminal content.
   *  - And relay to super setup methods.
   * */
  async setupRuntime() {

    // save before anything else, in case an error occur somewhere...
    this.editorCode = this.getCurrentEditorCode()
    this.save(this.editorCode)
    this.storeUserCodeInPython('__USER_CODE__', this.editorCode)

    this.terminal.pause()
    this.terminal.clear()
    this.terminal.echo(CONFIG.lang.runScript.msg)
    await sleep(200)

    return super.setupRuntime()
  }



  async teardownRuntime(options, gotError, gotFinal) {
    jsLogger("[Teardown] - IdeRunner -", JSON.stringify(gotError))

    if(!gotError && !gotFinal){
        this.giveFeedback(CONFIG.lang.successMsg.msg)
    }
    await super.teardownRuntime(options, gotError, gotFinal)
    this.storeUserCodeInPython('__USER_CODE__', "")
    this.focusEditor()
  }



  prefillTermIfAllowed(){
    // do nothing, but forbid the action on the parent class, which would raise an error
    // because prefillTerm is undefined, for IDEs.
  }



  //--------------------------------------------------------------------




  playFactory(){
    return withPyodideAsyncLock('play', async(e)=>{
      jsLogger("[Play]")
      if(e && e.preventDefault) e.preventDefault()
      this.resizeVerticalTerm()   // needed in case the first click is on a button

      let {options, stdErr, _} = await this.setupRuntime()
      if(stdErr) return;
      try{
          stdErr = await this.runPythonCodeWithOptions(this.editorCode, options)
      }finally{
          await this.teardownRuntime(options, stdErr, false)
      }
    })
  }




  //--------------------------------------------------------------------




  validateFactory(e){
    return withPyodideAsyncLock('Validate', async(e)=>{
      jsLogger("[Validate]")
      if(e && e.preventDefault) e.preventDefault()
      this.resizeVerticalTerm()   // needed in case the first click is on a button


      let {options, stdErr, isAssertErr} = await this.setupRuntime()
      let decrease_count = CONFIG.decreaseAttemptsOnUserCodeFailure
      let gotFinal = false

      // If an error, stop everything...
      if(stdErr){
        // ... but decrease the number attempts and run teardown if this was AssertionError.
        if(isAssertErr){
          gotFinal = this.handleRunOutcome(false, decrease_count)
          this.teardownRuntime(options, stdErr, gotFinal)
        }
        return   // jail break...  x)
      }

      try{
          // Define the user's code in the environment and run the public tests (if any)
          stdErr = stdErr || await this.runPythonCodeWithOptions(this.editorCode, options)
          decrease_count &&= !!stdErr

          // Run the validation tests only if the user's code succeeded at the previous step
          if(!stdErr){
            /*
            Quit if no secret tests, ignoring any public tests.
            This is so that the behavior for Ctrl+Enter is compliant with the GUI: the
            validation button is present only if secret tests are present.
            */
            if(!this.secretTests) return    // NOTE: should never happen anymore...

            // If still running, run the original public tests and the secret ones...
            const fullTests       = `${ this.publicTests }\n\n${ this.secretTests }`.trim()
            options.withStdOut    = !CONFIG.deactivateStdoutForSecrets
            options.isPublic      = !CONFIG.showOnlyAssertionErrorsForSecrets
            options.autoLogAssert = this.autoLogAssert!==null ? this.autoLogAssert
                                                              : CONFIG.showAssertionCodeOnFailedTest

            decrease_count = stdErr = await this.runPythonCodeWithOptions(fullTests, options)
          }

          /* Reveal solution and REMs on success, or if the counter reached 0 and the sol&REMs
            content is still encrypted.
            Prepare an appropriate revelation message if needed (`finalMsg`).
          */

          gotFinal = this.handleRunOutcome(!stdErr, decrease_count)

        }catch(e){
          // If something didn't get caught, it's very wrong... so dump everything to the console
          // NOTE: nothing is thrown anymore, because everything is started async, now ! x/
          this.terminal.echo(youAreInTroubles(e))

      }finally{
          await this.teardownRuntime(options, stdErr, gotFinal)
      }
    })
  }




  /**
   * @returns true if a final message is given (means, no "finished without error")
   * */
  handleRunOutcome(success, allowCountDecrease){

    if(!success && allowCountDecrease){
      this.decreaseIdeCounter()
    }
    if(this.revealSolutionAndRemsIfNeeded(success)){
      const finalMsg = success ? this._buildSuccessMessage()
                               : this._getSolRemTxt(false)
      if(finalMsg){
        this.giveFeedback(finalMsg)
        return true
      }
    }
    return false
  }


  /**Decrease the number of tries left, unless:
   *    - The solution is already revealed
   *    - The number of tries is infinite
   *    - There no attempts left (redundant with revelation condition, but hey...)
   */
  decreaseIdeCounter(){
    if(!this.corrHidden) return    // already revealed => nothing to change.

    // Allow going below 0 so that triggers once only for failure.
    const nAttempts = Math.max(-1, this.attemptsLeft - 1)
    this.data.attempts_left = nAttempts

    // Update the GUI counter if needed (check for encryption in case
    // the user already solved the problem)
    if (Number.isFinite(nAttempts) && nAttempts >= 0){
      $(this.counterH).text(nAttempts)
    }
  }


  /**Given the outcome of the current run, check if the sol&REMs must be revealed or not,
   * and apply the needed DOM modifications if so.
   *
   * Revelation occurs if:
   *    - Sol&REMs are still hidden,
   *    - Some Sol&REMs actually exist,
   *    - The run is successful or all attempts have been consumed.
   *
   * @returns: boolean, telling if the revelation occurred or not.
   */
  revealSolutionAndRemsIfNeeded(success){
    const someToReveal = this.corrHidden && this.corrRemsMask && (success || this.attemptsLeft==0)
    if(someToReveal){
      const sol_div = $("#solution_" + this.id)
      const compressed = sol_div.text()
      const content = decompressLZW(compressed)
      sol_div.html(content).attr('class', '')       // update + unhide
      mathJaxUpdate()               // Enforce formatting, if ever...
      this.corrHidden = false      // Forbid coming back here
      return true
    }
    return false
  }


  _buildSuccessMessage(){
    const emo = choice(CONFIG.MSG.successEmojis)
    let info = this._getSolRemTxt(true)
    return `${ success(CONFIG.lang.successHead.msg) } ${ emo } ${ CONFIG.lang.successHeadExtra.msg }${ info }`
  }


  _getSolRemTxt(isSuccess){
    if(!this.corrRemsMask) return ""

    const msg=[], sentence=[], mask = this.corrRemsMask

    msg.push( isSuccess
        ? "\n"+CONFIG.lang.successTail.msg
        : failure(CONFIG.lang.failHead.msg)
    )

    if(mask & 1) sentence.push(CONFIG.lang.revealCorr.msg)
    if(mask===3) sentence.push(CONFIG.lang.revealJoin.msg)
    if(mask & 2) sentence.push(CONFIG.lang.revealRem.msg)

    if(!isSuccess){
        if(sentence.length) sentence[0] = _.capitalize(sentence[0])
        if(mask&2)          sentence.push(CONFIG.lang.failTail.plural)
        else if(mask)       sentence.push(CONFIG.lang.failTail.msg)
    }
    msg.push(...sentence)
    return msg.join(' ').trimEnd() + "."
  }
}