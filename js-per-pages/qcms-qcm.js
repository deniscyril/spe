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


const STATE = {
    checked: "checked",
    unchecked: "unchecked",
    ok: 'correct',
    wrong: 'incorrect',
    missed: 'missed',
    multi: 'multi',
    single: 'single',
}




const shuffleDomInPlace=(shufflable)=>{

    const parent = $($(shufflable.shuffleParentPath)[0])
    const items  = [...parent.find(shufflable.shuffleChildrenPath).detach()]

    const shuffledItems = _.shuffle(items)
    shuffledItems.forEach(item=>parent.append(item))
}





class QCM {
    constructor(id, shuffle, reveal){
        this.qcmClass = id      // this class is actually used only once, so equivalent to an id
        this.innerDivPath = CONFIG.element.qcmInnerDiv
        this.counterPath = `${ this.innerDivPath } p${ CONFIG.element.qcmCounterCls }`
        this.shuffle = shuffle
        this.reveal = reveal
        this.questions = []     // Question[]
        this.locked = false

        this.shuffleParentPath = `.${ id }>${ this.innerDivPath }>ol`
        this.shuffleChildrenPath = ">li"

        this.createButtonsAndCounter()
    }

    addQuestion(question){
        this.questions.push(question)
        question._inject(this)
    }


    /**Reset all questions, and reshuffle the QCM is this.shuffle is true.
     * */
    restart(){
        this.locked = false
        this.questions.forEach(q=>q.resetAllItems(true))
        this.changeCounter()
        this.randomize()
    }

    /**Check the current answers of the user, revealing the correct answers or not.
     * */
    check(){
        if(this.reveal){
            this.questions.forEach(quest=>quest._reveal())
        }
        const [good,all] = this.questions.reduce( (track,quest)=>quest._validate(...track), [0,0])
        this.changeCounter(`${good}/${all}`)
        this.locked = true
    }

    changeCounter(content=""){
        const counter = $($('.'+this.qcmClass).find(this.counterPath)[0])
        counter.text(content)
    }


    /**Shuffle the questions and their items, if this.shuffle is true
     * */
    randomize(){
        if(this.shuffle){
            shuffleDomInPlace(this)
            this.questions.forEach(shuffleDomInPlace)
        }
    }


    createButtonsAndCounter(){

        const makeButton = (kind, options) => buttonWithTooltip(
            {shift:95, fontSize:1.1, ...options},
            `<img src="${ CONFIG.buttonIconsDirectory }/icons8-${ kind }-64.png" />`
        )

        const divAdmo    = $('.'+this.qcmClass)
        const children   = [...divAdmo.children()].slice(1)   // Exclude the title of the admonition
        const detached   = children.map(child => $(child).detach() )

        const innerDiv   = $(`<div class="${ this.innerDivPath.slice(1) }"></div>`)
        const mask       = $(createSvgMask(95, 1.1, CONFIG.lang.qcmMaskTip.msg, CONFIG.lang.qcmMaskTip.em))
        const checkBtn   = $(makeButton('check', {tipWidth: CONFIG.lang.qcmCheckTip.em,tipText: CONFIG.lang.qcmCheckTip.msg}))
        const restartBtn = $(makeButton('restart', {tipWidth:CONFIG.lang.qcmRedoTip.em, tipText: CONFIG.lang.qcmRedoTip.msg}))
        const counter    = $(`<p class="${ CONFIG.element.qcmCounterCls.slice(1) }"></p>`)
        const wrapper    = $(`<div class="${ CONFIG.element.qcmWrapper.slice(1) } ${ this.reveal?'give-away':'hidden' }"></div>`)
                                .append(counter, mask, checkBtn, restartBtn)

        innerDiv.append(...detached, wrapper)
        divAdmo.append(innerDiv)

        checkBtn.on('click', this.check.bind(this))
        restartBtn.on('click', this.restart.bind(this))
    }
}


const createSvgMask=(shift,fontSize, tipText, tipWidth) => `
<div class="tooltip mask-svg" style="--tool_shift:${ shift }%; font-size:${ fontSize }em;">
<span class="tooltiptext" style="width:${ tipWidth }em;">${ tipText }</span>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
viewBox="0 130 512 250" xml:space="preserve">
<path style="fill:var(--md-primary-fg-color)" d="M508.692,167.211c-14.625,0.984-64.391,5.859-128.781,5.859c-90.734,0-96.594,32.188-123.922,32.188 c-31.203,0-29.25-32.188-123.906-32.188c-64.391,0-114.156-4.875-128.781-5.859c-10.531-0.703,3.906,103.406,46.828,142.438 c32.5,29.547,111.234,54.656,172.703,13.656c23.422-18.516,33.156-18.516,33.156-18.516s9.781,0,33.188,18.516 c61.453,41,140.203,15.891,172.688-13.656C504.786,270.617,519.239,166.508,508.692,167.211z M202.442,255.305 c-45.656,50.922-120.297,15.797-121.172-35.141C165.552,207.008,205.755,251.602,202.442,255.305z M309.552,255.305 c-3.313-3.703,36.875-48.297,121.172-35.141C429.849,271.102,355.224,306.227,309.552,255.305z"></path>
</svg></div>`








class Question {

    constructor(jQuest, baseLiId, iQ, answers, isMulti){
        this.jThis = jQuest
        this.questId = baseLiId+'-'+iQ
        jQuest.attr('id', this.questId)      // Add the id to the Question <li> tag on the fly
        jQuest.attr('added-id', "on-the-fly")  // Add a warning...

        this.answers = answers //
        this.isMulti = isMulti
        this.qcm = null
        this.byId = {}          /* itemId: { checked:boolean, correct:boolean } */

        this.shuffleParentPath=`#${ this.questId }>ul`
        this.shuffleChildrenPath = ">li"
    }

    _clickFactory(itemId){
        return _=>{
            if(this.qcm.locked) return;
            const checked = !this.byId[itemId].checked
            if(!this.isMulti) this.resetAllItems()
            this.updateItem(itemId, checked)
        }
    }


    _validate(goods, all){
        const values = Object.values(this.byId)

        /* Count per item:
        goods += values.reduce( (s,o)=>s+(o.checked === o.correct), 0)
        all += values.length

        /*/ // Count per question:
        goods += values.every( o => o.checked === o.correct )
        all++
        //*/

        return [goods, all]
    }

    _reveal(){
        Object.entries(this.byId).forEach(([itemId,it])=>{
            const classes = []
            if(it.checked) classes.push(it.correct ? STATE.ok : STATE.wrong)
            else if(it.correct) classes.push(STATE.missed)

            if(classes.length){
                this._setClasses(itemId, ...classes)
            }
        })
    }

    _inject(qcm){ this.qcm = qcm }

    _getLabelClasses(itemId, ...classes){
        classes.push(this.isMulti ? STATE.multi : STATE.single)
        return `${ itemId } ${ classes.join(' ') }`
    }

    _setClasses(itemId, ...classes){
        const kls = this._getLabelClasses(itemId, ...classes)
        $(`label.${ itemId }`).attr('class', kls)
    }


    resetAllItems(always=false){
        Object.entries(this.byId).forEach(([itemId,it])=>{
            if(always || it.checked) this.updateItem(itemId, false)
        })
    }

    updateItem(itemId, checked){
        this.byId[itemId].checked = checked
        this._setClasses(itemId, checked ? STATE.checked : STATE.unchecked)
        $(`input.${ itemId }`).attr('checked', checked)      // for page semantic only...
    }


    registerItem(jLiItem, iItem){
        const itemId = this.questId + '-'+iItem

        // Build the new/augmented <li> tag, bind behaviors and replace the original with it:
        const newLi = $(this._wrapHtmlWithQcmLogistic(jLiItem, itemId))
        newLi.find('label').on('click', this._clickFactory(itemId))
        jLiItem.replaceWith(newLi)

        // Register data for later user's actions:
        this.byId[itemId] = {
            checked: false,
            correct: this.answers.includes(iItem+1),
        }
    }

    _wrapHtmlWithQcmLogistic(jLiItem, itemId){
        // Remove empty children tag (may occur because of the mix html + md in html declarations):
        for(let tag of jLiItem.children()) if(!tag.innerText) $(tag).remove()

        const inputId = `"${ itemId }-input"`
        const qcm_class = ` class="qcm ${itemId}" `
        const label_classes = this._getLabelClasses(itemId, 'unchecked')
        const finalHtml = `
<li id="${ itemId }">
<input type="checkbox" id=${ inputId } ${ qcm_class } >
<label for=${ inputId } class="${ label_classes }" >
  <?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <svg class="qcm" viewBox="0 0 12 12" role="img" version="1.1"
    xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"
    style="stroke-width:1.25;stroke-linecap:round">
    <path class="bgd-svg" style="fill:var(--qcm-fill);stroke:none;"
      d="M 5.93,1.93 3.29,2.40 2.70,2.75 1.86,5.70 2.38,8.76 2.75,9.29 5.82,10.13 9.07,9.45 9.36,9.13 10.12,6.11 9.49,2.93 9.12,2.65 Z"></path>
    <path class="tick"
      style="display:var(--tick);fill:var(--qcm-light);stroke:var(--qcm-light);stroke-width:0;stroke-linecap:butt;stroke-linejoin:round"
      d="M 6.34,8.49 C 6.49,7.32 7.07,5.36 9.05,4.06 L 8.93,3.91 C 7.13,4.50 6.38,5.52 5.63,7.03 5.36,6.61 3.91,5.92 3.47,5.86 L 3.32,6.00 C 4.41,6.54 5.06,7.30 5.63,8.77"></path>
    <g style="display:var(--cross);fill:var(--qcm-light);stroke:var(--qcm-light)"
      transform="matrix(0.91,0,0,0.91,0.52,0.52)">
      <rect width="8.33" height="0.59" x="-5.86" y="8.02" transform="rotate(-56.54)"></rect>
      <rect width="8.33" height="0.59" x="-12.47" y="-1.99" transform="matrix(-0.55,-0.83,-0.83,0.55,0,0)"></rect>
    </g>
    <g style="fill:none;stroke:var(--qcm-border)">
    <circle style="display:var(--circle)" cy="6" cx="6" r="4.2"></circle>
    <rect style="display:var(--square)" class="square" width="7.41" height="7.36" x="2.29" y="2.32"></rect>
    </g>
  </svg>
  <div class="content">${ jLiItem.html() }</div>
</label>
</li>`  //.replace(/\s+/g, " ")      // DON'T! (it messes up pre/code tags display)
        return finalHtml
    }
}









subscribeWhenReady("QCM", function(){
    jsLogger('[QCM]')

    const questions = "ol>li"
    const questionItems = ">ul>li"

    $(CONFIG.element.qcm_admos).each(function(){

        const qcmThis = $(this)

        const classes        = qcmThis.attr('class').split(' ')
        const qcmId          = classes.find(kls=>kls.startsWith("py_mk_qcm_id"))
        const shuffle        =  qcmThis.hasClass('qcm_shuffle')
        const reveal_results = !qcmThis.hasClass('qcm_hidden')
        const multi_behavior =  qcmThis.hasClass('qcm_single') + 2 * qcmThis.hasClass('qcm_multi')

        if(!qcmId){
            throw new Error(
                "No qcm ID found. Don't forget to use the {{ def_qcm() }} macro if "
              + "you create qcms directly in the markdown files."
            )
        }
        const qcmObj = new QCM(qcmId, shuffle, reveal_results)

        let iQuest=-1
        qcmThis.find(questions).each(function(){
            iQuest++; let iItem=0;

            const jQuest = $(this)
            const q_multi_behavior = jQuest.hasClass('qcm_multi') * 2
                                   + jQuest.hasClass('qcm_single')
            const answers = jQuest.attr('correct') || ""
            jQuest.removeAttr('correct')

            if(!answers){
                console.warn(
                    "[Pyodide-Mkdocs - QCM]\nCorrect answer(s) unknown for this question:"
                  + `\n\t"${ jQuest.text() }"`
                )
            }
            const ansArr = answers.split(",").map(Number)
            const isMulti = ansArr.length>1 || (
                q_multi_behavior ? q_multi_behavior&2 : multi_behavior&2
            )
            if(ansArr.length==1 && !q_multi_behavior && !multi_behavior){
                console.warn(
                    "[Pyodide-Mkdocs - QCM]\nA qcm question has only one correct answer, but the "
                   + `multi/single choice aspect is unknown.\nQuestion: ${ jQuest.text() }`
                )
            }

            const question = new Question(jQuest, qcmId, iQuest, ansArr, isMulti)
            $(this).find(questionItems).each(function(){
                question.registerItem($(this), iItem++)
            })
            qcmObj.addQuestion(question)        // Done last, to be sure everything is up to date
        })

        qcmObj.randomize()
    })

}, {now:true})
