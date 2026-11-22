import{mkdirSync,readdirSync,readFileSync,writeFileSync}from'node:fs';
import{join}from'node:path';
const A=process.env.MAKEFUN_INPUT_DIR??'/input',B=process.env.MAKEFUN_OUTPUT_DIR??'/output';
const O=[0,1,2,3,4,5,6,7,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,32,33,34,48,49,50,51,52,64,65,80,81,82,83],H='000101401010012022023033021021021021021021021011021021021011021021021021021021200210210200000011020010010001010',K=new Uint8Array(256),I=new Uint8Array(256),P=new Uint8Array(256),U=new Uint8Array(256);
O.forEach((o,i)=>{K[o]=1;I[o]=+H[3*i];P[o]=+H[3*i+1];U[o]=+H[3*i+2]});
function run(p,inp){const n=p.length,S=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),o=new Uint8Array(65536);let s=0,c=0,l=0,j=0,x=0,t=0;const d=e=>({out:o.slice(0,l),code:e});
for(;;){if(t==1e6)return d(10);if(x<0||x>=n)return d(9);const g=p[x];if(!K[g])return d(5);const m=I[g];if(x+m>=n)return d(9);t++;const y=x+1+m;if(s<P[g])return d(2);if(s-P[g]+U[g]>256)return d(3);x=y;
switch(g){
case 0:return d(0);
case 1:S[s++]=(p[y-1]<<24)>>24;break;
case 2:S[s++]=p[y-4]|p[y-3]<<8|p[y-2]<<16|p[y-1]<<24;break;
case 3:s--;break;
case 4:S[s]=S[s-1];s++;break;
case 5:{const a=S[s-1];S[s-1]=S[s-2];S[s-2]=a;break}
case 6:S[s]=S[s-2];s++;break;
case 7:{const a=S[s-3];S[s-3]=S[s-2];S[s-2]=S[s-1];S[s-1]=a;break}
case 23:S[s-1]=-S[s-1]|0;break;
case 27:S[s-1]=~S[s-1];break;
case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:{const b=S[s-1],a=S[s-2];let r;if(g==16)r=a+b|0;else if(g==17)r=a-b|0;else if(g==18)r=Math.imul(a,b);else if(g<23){if(!b)return d(4);r=g==19?(a/b)|0:g==20?a%b|0:g==21?(a>>>0)/(b>>>0)|0:(a>>>0)%(b>>>0)|0}else if(g==24)r=a&b;else if(g==25)r=a|b;else if(g==26)r=a^b;else if(g==28)r=a<<(b&31);else if(g==29)r=a>>(b&31);else if(g==30)r=a>>>(b&31)|0;else if(g==32)r=a==b?1:0;else if(g==33)r=a<b?1:0;else r=(a>>>0)<(b>>>0)?1:0;s-=2;S[s++]=r;break}
case 48:case 49:case 50:{const e=(p[y-2]|p[y-1]<<8)<<16>>16;let f=g==48;if(g!=48){const v=S[--s];f=g==49?v==0:v!=0}if(f)x=y+e;break}
case 51:if(c==64)return d(7);C[c++]=y;x=p[y-2]|p[y-1]<<8;break;
case 52:if(!c)return d(8);x=C[--c];break;
case 64:{const a=S[s-1];if(a<0||a>255)return d(6);S[s-1]=M[a];break}
case 65:{const a=S[s-1];if(a<0||a>255)return d(6);M[a]=S[s-2];s-=2;break}
// Case 80 prints a signed 32-bit int as decimal: count digits first (z),
// reserve h bytes, then fill them right-to-left with a leading '-' if needed.
case 80:{const v=S[s-1],u=v<0?-v:v;let z=1,w=u;while(w>=10){w=w/10|0;z++}const h=z+(v<0?1:0);if(l+h>65536)return d(11);s--;let q=l+h;w=u;
do{o[--q]=48+w%10;w=w/10|0}while(w>0);if(v<0)o[--q]=45;l+=h;break}
case 81:if(l+1>65536)return d(11);o[l++]=S[--s]&255;break;
case 82:S[s++]=j<inp.length?inp[j++]:-1;break;
case 83:return d(S[--s]&255);
default:return d(5);
}}}
for(const id of readdirSync(A).sort()){const r=run(new Uint8Array(readFileSync(join(A,id,'program.bin'))),new Uint8Array(readFileSync(join(A,id,'input.bin'))));mkdirSync(join(B,id),{recursive:true});writeFileSync(join(B,id,'stdout.bin'),r.out);writeFileSync(join(B,id,'exit.txt'),r.code+'\n')}
