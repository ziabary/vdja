window.MathJax = {
  loader: {
    load: ['[tex]/colorv2', '[tex]/tagformat', '[tex]/bbox', '[tex]/action', '[tex]/enclose', '[tex]/html']
  },
  startup: {
    typeset: false,
    invalidOption: 'warn'
  },
  options: {
    enableMenu: false,
    // renderActions: {
    //   addMenu: []
    // },
    enableComplexity: true, // set to false to disable complexity computations
    makeCollapsible: true // insert mactions to allow collapsing

  },
  tex: {
    packages: { '[+]': ['tagformat', 'color', 'bbox', 'action', 'enclose', 'html'] },
    autoload: { color: [] },
    tagSide: 'left',
    inlineMath: [['$', '$']],
    macros: {
      RR: '{\\bf R}',
      bold: ['{\\bf #1}', 1]
    },
    tagformat: {
      tag: (n) => '[' + n + ']'
    }
  }
}

// { \enclose{circle}[mathcolor="red"]{\color{black}{x}} \mathtip{\sum DC_{send}}{\sum me_{rec}} \bbox[red,2pt]{\sum DC_{send}} + \sum (Internal \not\subset DC)_{oneway} + \sum \psi_{total} + \partial_{oneway} } \over {\sum U_{receive} + e_{external} }

// { \class{h}{\sum DC_{send}} + \class{h}{\sum (Internal \not\subset DC)_{oneway}} + \class{h}{\sum \psi_{total}} + \class{h}{\partial_{oneway}} } \over {\class{h}{\toggle{\sum {U_{receive}}}{\sum {PE_{Mobile_{receive}}} + \sum{PE_{NonMobile_{receive}}} + \sum DC_{NonMobile_{send}}}\endtoggle} + \class{h}{e_{external}} }
