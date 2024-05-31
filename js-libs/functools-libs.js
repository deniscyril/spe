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



/**Decorator like factory function, managing the global pyodide lock.
 * If a call is done while pyodide is locked, it is delayed until the lock is available.
 * */
var withPyodideAsyncLock = (_=>{

    /* Everything is run async but single threaded, so a global lock can be added, using
     * a simple simple boolean flag, declared inside a closure to avoid a user messing
     * with the variable... */
    let pyodideLocked = false

    return function(name, asyncCallback){
        const logName = asyncCallback.name||name

        const wrapper = async function(...args){
            await waitForPyodideReady()

            jsLogger("[LOCK?] -", logName, pyodideLocked)
            while(pyodideLocked){
                await sleep(100)
            }
            jsLogger("[LOCK ACQUIRE] -", logName)
            pyodideLocked = true
            let ret;
            try{
                ret = await asyncCallback.apply(this, args)
            }catch(e){
                console.log(e)      // Always keep that, otherwise errors in JS are just swallowed
                                    // (impossible to rethrow them, not sure why... async probably)
            }finally{
                pyodideLocked = false
                jsLogger("[LOCK RELEASE] -", logName)
            }
            return ret
        }
        return wrapper
    }

})()



/**Allow to delay the executions of various functions, until the pyodide environment
 * is done loading.
 * */
async function waitForPyodideReady(){

    const maxWaitingTime = 20  // in seconds
    const attempts = 80
    const step_ms = Math.round(1000 * maxWaitingTime / attempts)

    let counter = 0
    while(!globalThis.pyodideIsReady){
        await sleep(step_ms);
        if(++counter == attempts){
            throw new Error(`Couldn't access to pyodide environment in time (${maxWaitingTime}s)`)
        }
    }
}




/**Auto-subscription routine to document changes.
 * If the subscription is not possible yet (readyForSubscription[waitOn] is falsy), try again
 * @delay later until it works.
 *
 * @waitId :  Property to observe in readyForSubscription global object.Also used as subscription
 *            identifier.
 * @callback: Routine to run when the document changes
 * @options : An object with optional fields:
 *      .delay (=50): Time interval (in ms) to wait in between two subscription attempts.
 *      .now (=false): If true, ignore the CONFIG.subscriptionReady property and subscribe at call
 *              time. If false, a callback will be returned by the `subscribeWhenReady` function,
 *              that the caller can use to signal when the subscription is ready.
 *      .waitFor (=null): If given, it must be a boolean provider or a jquery identifier string,
 *              which will result in a function checking for the existence of that element in
 *              the DOM. This function will be called every .delay ms and the subscription will
 *              be delayed until it returns true. This has precedence over the .now option.
 *
 * @throws: Error if more than 20 subscriptions attempts are done without success.
 * */
function subscribeWhenReady(waitId, callback, options={}){

    let {now, delay, waitFor} = {
        delay: 50,
        now: false,
        waitFor: null,
        ...options
    }
    now = now && !waitFor                       // has to wait if waitFor is used
    CONFIG.subscriptionReady[waitId] = now

    const checkReady = !waitFor                  ? ()=>null
                     : typeof(waitFor)=='string' ? ()=>{ CONFIG.subscriptionReady[waitId] = $(waitFor).length>0 }
                                                 : ()=>{ CONFIG.subscriptionReady[waitId] = waitFor() }
    const isNotReady =()=>{
        checkReady()
        return !CONFIG.subscriptionReady[waitId] || !globalThis.document$
    }

    function autoSubscribe(){

        if(isNotReady()){
            const nTries = CONFIG.subscriptionsTries[waitId]+1 || 1
            if(nTries==20){
                throw new Error(`Impossible to subscribe to ${ waitId } in time: too many tries.`)
            }
            CONFIG.subscriptionsTries[waitId] = nTries
            setTimeout(autoSubscribe, delay)

        }else{
            jsLogger('[Subscribing] -', waitId)
            const wrapper=function(){
                try{
                    callback()
                }catch(e){
                    console.log(e)
                }
            }
            const subscript = document$.subscribe(wrapper)
            document.addEventListener(CONFIG.onDoneEvent, function(){
                jsLogger("[Unsubscribing] -", waitId)
                subscript.unsubscribe()
            })
        }
    }

    autoSubscribe()

    if(!now) return ()=>{ CONFIG.subscriptionReady[waitId]=true }
}







/**Square brackets in "rich text format" must be escaped, otherwise they are messing up the
 * terminal formatting informations.
 * */
function escapeSquareBrackets(msg){
    return msg.replace(/\[/g, CONFIG.MSG.leftSafeSqbr)
              .replace(/\]/g, CONFIG.MSG.rightSafeSqbr)
}


/**Formatting factory function, for messages used in the jquery terminal.
 *
 * WARNING: the input message will be "escapeSquareBrackets"-ed.
 * */
function richTextFormat(content, style, color="", background="") {
    content = escapeSquareBrackets(content)
    return `[[${ style };${ color };${ background }]${ content }]`;
}

let error   = (content) => richTextFormat(content, "b", "red");
let warning = (content) => richTextFormat(content, "", "orange");
let stress  = (content) => richTextFormat(content, "b");
let info    = (content) => richTextFormat(content, "i", "grey");
let italic  = (content) => richTextFormat(content, "i");
let success = (content) => richTextFormat(content, "ib", "green");
let failure = (content) => richTextFormat(content, "ib", "orange");


// Update CONFIG strings on the fly:
'successMsg runScript installStart installDone'
    .split(' ').forEach(
        prop=>CONFIG.lang[prop].msg = info(CONFIG.lang[prop].msg)
    )




/**Takes a string and cut the "middle chunk" of them if it is considered too long (length > 1750),
 * shortening it in the following way:
 *   - keep the 500 first and 300 last chars
 *   - replace the middle with a message
 * */
function textShortener(text){
    if(CONFIG.cutFeedback && text.length > CONFIG.feedbackShortener.limit){
        const head = text.slice(0,CONFIG.feedbackShortener.head)
        const tail = text.slice(-CONFIG.feedbackShortener.tail)
        text = `${ head }\n...\n${ CONFIG.feedbackShortener.msg }\n...\n${ tail }`
    }
    return text
}



/**Create a button with tooltip, just like the python _html_builder one.
 * */
function buttonWithTooltip(options, content){
    options = {
        buttonId: "",
        shift: 50,          // %
        fontSize: 1.5,      // em
        tipWidth: 15,       // em
        tipText: "",
        ...options
    }
    options.tipWidth = options.tipWidth>0 ? `style="width:${ options.tipWidth }em;"` : ""
    const buttonId = !options.buttonId ? "" : `id="${ options.buttonId }" `
    return `
<button ${ buttonId }class="tooltip header-btn" type="button"
 style="--tool_shift:${ options.shift }%; font-size:${ options.fontSize }em;">
    <span class="tooltiptext" ${options.tipWidth}>${ options.tipText }</span>
    ${ content }
</button>
`
}



/**Randomly pick a value from an array.
 * @throws Error if the array is empty.
 * */
function choice(arr){
    if(!arr.length){
        throw new Error("Cannot pick from an empty array")
    }
    const i = Math.random() * arr.length | 0
    return arr[i]
}


/**Applique c ^ key à chaque nombre de text
 * (Nota: 43960 = 0b1010101010101010)
 * */
const decrypt_string=(text, key = 43960) =>{
    if(!CONFIG.encryptCorrectionsAndRems) return text
    return text.split('.').map(c=>String.fromCodePoint( key ^ +c )).join('')
}

const ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&'()*+,-./:;=?@^_`{|}~"
const TOME_B = [...ALPHA].reduce((o,c,i)=>(o[c]=i,o), {})

const unBase =s=> [...s].reduce((v,c)=>v*ALPHA.length + TOME_B[c], 0)

/**@txt: CONFIG.LZW separated lines, with:
 *      1. dot separated unicode char codes
 *      2. regular alpha
 *      3. compressed data, size 2
 *      4. ..., size 3,
 *      5. ...
 */
const decompressLZW=(compressed)=>{

    const [bigs, smalls, ...chunks] = compressed.trim().split(CONFIG.LZW)
    const tome = [
        [...'><'],
        bigs=='.' ? [] : bigs.slice(1)    // no initial dot
                             .split('.')
                             .map(n=>String.fromCodePoint(+n)),
        [...smalls],
    ].flat()

    let txt=[], size=1, out=[]
    chunks.forEach(chunk=>{
        size++
        if(chunk.length%size){
            console.log(chunk)
            // throw new Error(`Wrong chunk: size=${size}, length=${chunk.length}`)
        }
        for(let i=0 ; i<chunk.length ; i+=size){
            txt.push(unBase(chunk.slice(i,i+size)))
        }
    })
    txt.forEach((iBase,i)=>{
        const s = tome[iBase]
        const fresh = s + (tome[txt[i+1]] || s)[0]
        out.push(s)
        tome.push(fresh)
    })
    return out.join('')
}

const escapeSqBrackets=msg=>{
    return msg.replace(CONFIG.ESCAPE_SQ_B, c=>SqBs[c])
}

const unEscapeSqBrackets=msg=>{
    return msg.replace(CONFIG.UNESCAPE_SQ_B, c=>SqBs[c])
}

/**Async sleep (time given in milliseconds / must be awaited by the caller)
 * */
function sleep(ms=0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}



// Code issued from https://stackoverflow.com/questions/5379120/get-the-highlighted-selected-text
function getSelectionText() {
    let text = "";
    if(window.getSelection) {
        text = window.getSelection().toString();

    }else if(document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}
