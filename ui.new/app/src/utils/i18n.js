function persianDigit2English (number) {
      const find = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
      const replacement = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
      replacement.forEach(englishIndex => {
        number = number.replace(find[englishIndex], englishIndex)
      })
      return number
}

const months = ['فررودین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند']

function date2Jalali(date = undefined) {
    const gregorian = date ? new Date(date) : new Date()
    const jalali = gregorian.toLocaleDateString("fa-IR").split("/")
    const jDate = `${jalali[0]} ${months[persianDigit2English(jalali[1])*1-1]} ${jalali[2]}`
    return jDate
}

module.exports ={
    persianDigit2English,
    date2Jalali
}
