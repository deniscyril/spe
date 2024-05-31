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


/**Return the plain error message, unless it's an assertion error, where the message is formatted.
 * @err (Error):   The Error object caught in JS context.
 * @code (string): The python code that (possibly) generated the error.
 * @allowAssertCodeExtraction (boolean=true): If the error is an AssertionError without message, automatically add
 *                 the assertion instruction if autoMsg is true.
 * @purgeErr (boolean): if true, the complète stacktrace will be removed of error messages
 *
 * ---
 *
 * ## Rationals
 *
 * - The argument error can be of any kind (JS or python)
 * - "Legit" errors are those starting with "PythonError".
 * - Any error that isn't considered "legit" will add a specific warning at the end of the error
 *   message, saying to the user to contact the webmaster, because there is a problem in the code
 *   and/or the exercice.
 * - "Legit" errors are studied and cleaned up in various ways. Mostly:
 *   - remove any lines related to pyodide environment (unless the error is identified as "legit",
 *     but also problematic)
 *   - possibly add the assertion code (if allowed) for bare AssertionErrors.
 *   - reduce the size of the stacktrace and/or the error message if they are too big (to avoid
 *     having the terminal lagging like hell...)
 *
 *
 * ## Searching for AssertionError:
 *
 * This is not totally trivial, because it must be made sure that the code finds the actual error
 * type declaration in the string, and not a false positive:
 *
 *      ```python
 *      raise ValueError("should be AssertionError")
 *      ```
 *      -> Forbids simple inclusion checks.
 *
 *      ```python
 *      raise ValueError("""
 *      Hey, the could should have raised:
 *      AssertionError!
 *      """)
 *      ```
 *      -> Forbids simple `startsWith` checks.
 *
 * To avoid this, "AssertionError" is searched at the beginning of a line, with the previous line
 * starting with '  File "<exec>"'.
 *
 * Note: the online REPL show a '  File "<console>"' instead, but the behavior stays the same.
 *
 *
 * ---
 *
 *
 * Example of an input error message in pyodide 0.23.1:
 *
 *      PythonError: Traceback (most recent call last):
 *        File "/lib/python3.10/site-packages/_pyodide/_base.py", line 435, in eval_code
 *          .run(globals, locals)
 *        File "/lib/python3.10/site-packages/_pyodide/_base.py", line 304, in run
 *          coroutine = eval(self.code, globals, locals)
 *        File "<exec>", line 4, in <module>
 *        File "<exec>", line 7, in ecrete
 *        File "<exec>", line 12, in limite_amplitude
 *      ValueError: blabla
 *
 *
 * Example of an input error message in pyodide 0.25.0:
 *
 *      PythonError: Traceback (most recent call last):
 *        File "/lib/python311.zip/_pyodide/_base.py", line 501, in eval_code
 *          .run(globals, locals)
 *           ^^^^^^^^^^^^^^^^^^^^
 *        File "/lib/python311.zip/_pyodide/_base.py", line 339, in run
 *          coroutine = eval(self.code, globals, locals)
 *                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *        File "<exec>", line 1, in <module>
 *      AssertionError: This message...
 *
 *
 * Example of error involving RecursionError with repeated lines:
 *
  *     PythonError: Traceback (most recent call last):
  *       File "/lib/python311.zip/_pyodide/_base.py", line 501, in eval_code
  *         .run(globals, locals)
  *          ^^^^^^^^^^^^^^^^^^^^
  *       File "/lib/python311.zip/_pyodide/_base.py", line 339, in run
  *         coroutine = eval(self.code, globals, locals)
  *                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  *       File "<exec>", line 2, in <module>
  *       File "<env>", line 10, in essai
  *       File "<env>", line 10, in essai
  *       File "<env>", line 10, in essai
  *       [Previous line repeated 44 more times]
  *     RecursionError: maximum recursion depth exceeded
 * */
function generateErrorLog(err, code, allowAssertCodeExtraction, purgeErr=false) {

  const msg = String(err).trimEnd() // Note: err has a trailing linefeed, so, trim it...


  // Return directly non python errors. => allows to also see JS errors.
  if(!msg.startsWith('PythonError')){
    return [youAreInTroubles(err), false]
  }

  const errLines = msg.split("\n")

  /*
  Search for the first line after the pyodide-specific infos, avoiding false positives for
  terminals, where the second line is: ""  File "<exec>", line dd, in await_fut".
  Also, in case of SyntaxError, there is no indication after the line number (REMINDER: the
  negative lookahead CANNOT start just after the number or the await_fut thing is matched
  when the line number has more than 1 digit..., so must use another strategy).
  */
  const iModule = errLines.findIndex(s=>CONFIG.MODULE_REG.test(s))

  /*
  Python errors may sometimes be coming from side effects of restrictions: those may not come
  from the execution of the user's code and the stacktrace, may then not content the desired
  pattern, aka, the "file" may be neither exec nor console. (this happens for example with a
  recursion limit set too low: the error is raised when extracting stdout only).
  */
  const isFromUserCode = iModule > 0

  const [iError,isAssertErr] = getErrorKindInfos(errLines)

  // If ExclusionError, just throw the last line without anything else:
  if(errLines[iError].includes(CONFIG.MSG.exclusionMarker)){
    const msg = errLines.slice(iError).join('\n')
    const i   = msg.indexOf(CONFIG.MSG.exclusionMarker)
    return [msg.slice(i), false]
  }

  const isMultiLineError = iError+1 < errLines.length
  const cleaned = (errLines[iError] || "").replace("AssertionError","").trim()
  const hasNoMsg = !isMultiLineError && !cleaned

  // WARNING: working by mutation, so successive splices are done 'from the end".

  // Rebuild the assertion message first, if needed:
  if( isAssertErr && hasNoMsg && allowAssertCodeExtraction ){
    const bigFail = buildAssertionMsg(code, errLines, iError)
    if(bigFail) return [bigFail, false]

  }else if(!isAssertErr && purgeErr){
    // Reformat error message if needed
    const errKind = errLines[iError].split(':')[0]
    errLines.splice(iError, errLines.length)
    errLines.push(`${errKind} has been raised.`)
  }

  // Shorten the error code section (if multiline assertion message), and then the stacktrace.
  shortenArrSection('err',   errLines, iError, errLines.length-1, iModule, purgeErr)

  // Remove pyodide related information from the stacktrace (the user doesn't need to know) if
  // it's the user's code that is run, otherwise, keep the full stack trace to ease debugging:
  if(isFromUserCode){
    shortenArrSection('trace', errLines, iModule, iError-1, iModule, purgeErr)

  }else{
    errLines.push(CONFIG.MSG.bigFail)
  }
  return [errLines.join('\n'), isAssertErr]
}



/**Mutate the content of the given array, if the section identified by the original `from` and
 * `to` indices is considered too long.
 * Both indices arguments are inclusive.
 * */
const shortenArrSection=(kind, errLines, from, to, iModule, purgeErr)=>{

  if(kind=='trace' && purgeErr){
    errLines.splice(0, to+1)
    return
  }

  if(CONFIG.cutFeedback){

    const [limit, head, tail] = "Limit Head Tail".split(' ').map( prop => CONFIG.feedbackShortener[kind+prop] )
    if(to-from > limit){
      from += head
      to -= tail
      let middle = CONFIG.feedbackShortener.msg
      if(kind=='trace'){
        middle = middle.replace(
          CONFIG.MSG.rightSafeSqbr,
          `, ${ to-from-1 } more lines here...${ CONFIG.MSG.rightSafeSqbr }`
        )
      }
      errLines.splice(from, to-from+1, middle)
    }
  }

  if(kind!='trace') return

  // Then remove or reformat pyodide specific lines (nly if this is the last operation, aka "trace")
  errLines.splice(1, iModule-1)
  errLines[0] = errLines[0].slice( 'PythonError: '.length )
}




/**Travel through the lines of an error message from the end, and spot the line index of the
 * raised Error, assuming it will be preceded by a line starting with `  File "<(exec|console)>"`
 * and return the index of the error line, and a boolean saying if the error was or not an
 * AssertionError.
 * */
const getErrorKindInfos=(arr)=>{
  for(let i=arr.length-1 ; i>0 ; i--){
    const previousLine = arr[i-1]   // Always defined, see loop stop
    const line = arr[i]

    const isLastTrace = CONFIG.TRACE_REG.test(previousLine)
    if(isLastTrace){
      // RecursionError may return a message with an extra line
      if(line.startsWith("  [Previous line repeated")){
        if(!arr[++i] || !arr[i].startsWith('RecursionError')){
          throw new Error(
            `Expected RecursionError, but found something else:\n\n${ arr.join('\n') }`
          )
        }
        return [i,false]
      }

      return [i, line.startsWith('AssertionError')]
    }
  }
  return [arr.length-1, false]
}




/**Get back the full python assertion instruction, by extracting the lines it covers,
 * through the use of the ast module in pyodide, then mutate the array representing
 * the error message accordingly.
 * */
function buildAssertionMsg(code, errLines, iAssertionError){

  const callLine = errLines[iAssertionError-1] || ""

  const numMatch = callLine.match(CONFIG.TRACE_NUM_LINE)
  if(!numMatch){
    throw new Error(`
Couldn't determine the line number of the assertion in:
      ${ callLine }
    Error message:\n${ errLines.join('\n') }`)
  }

  // The double quotes are all escaped to make sure no multiline string will cause troubles
  const escapedCode = code.replace(/"/g, '\\"')
  const lineNo = +numMatch[1]
  const astExplorer = `

def _hack___________():
    import ast
    code = """${ escapedCode }"""
    tree = ast.parse(code)
    assertNode = next( node for node in ast.walk(tree)
                            if isinstance(node, ast.Assert) and node.lineno==${ lineNo } )

    i,j = assertNode.lineno-1, assertNode.end_lineno
    return '\\n'.join(code.splitlines()[i:j])

_ = _hack___________()
del _hack___________
_`
  let assertion
  try{
    assertion = pyodide.runPython(astExplorer)
  }catch(e){
    // Any error here must be caught and returned, otherwise it will just
    // be swallowed (somehow...)
    return youAreInTroubles(e)
  }
  const assertArr = assertion.split('\n')
  errLines[ errLines.length-1 ] += ':\n' + assertArr.splice(0,1)[0]
  errLines.push(...assertArr)
}




/**Extract full information when something gets VERY wrong... */
function youAreInTroubles(err){
  return `${ err }\n\n${ err.stack || '[no stack]' }\n${ CONFIG.MSG.bigFail }`
}