import MarkdownIt from 'markdown-it';
export const SANITIZE_OPTIONS={
  ALLOWED_TAGS:['p','br','strong','em','del','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','pre','code','a','table','thead','tbody','tr','th','td','hr'],
  ALLOWED_ATTR:['href','title','rel','target'],FORBID_TAGS:['script','style','iframe','svg','math'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false
};
const markdown=new MarkdownIt({html:false,linkify:true,breaks:true,typographer:false}).disable('image');
markdown.validateLink=(url:string)=>/^(https?:\/\/|mailto:|\/[^/]|#)/i.test(url)&&!/[\u0000-\u001f]/u.test(url);
const defaultLink=markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open=(tokens,index,options,env,self)=>{
  const token=tokens[index],href=String(token.attrGet('href')??'');
  if(/^https?:\/\//i.test(href)){token.attrSet('target','_blank');token.attrSet('rel','noopener noreferrer');}
  return defaultLink?defaultLink(tokens,index,options,env,self):self.renderToken(tokens,index,options);
};
export function markdownToHtml(source:string):string{return markdown.render(source);}
