from pathlib import Path
import struct,base64,json,hashlib
root=Path(__file__).resolve().parents[2]
p=root/'02-宿主参考-只读/v4.3.png';raw=p.read_bytes();pos=8;meta={}
while pos<len(raw):
 n=struct.unpack('>I',raw[pos:pos+4])[0];tag=raw[pos+4:pos+8];data=raw[pos+8:pos+8+n];pos+=n+12
 if tag==b'tEXt':
  key,_,value=data.partition(b'\0')
  if key in (b'chara',b'ccv3'):meta[key]=json.loads(base64.b64decode(value))
doc=meta.get(b'ccv3',meta.get(b'chara'));doc=doc.get('data',doc)
entries=doc['character_book']['entries'];out=[]
for entry in entries:
 title=entry.get('comment',entry.get('name',''))
 if any(k in title for k in ['种族','登神','核心数值','生命层级','品质规则']):
  out.append({'id':str(entry.get('id',entry.get('uid',''))),'title':title,'keys':entry.get('keys',entry.get('key',[])),'text':entry.get('content','')})
target=Path(__file__).resolve().parents[1]/'src/compiler/host-rule-data.ts'
target.write_text('// Read-only card reference extraction; never evaluates embedded templates.\nexport const HOST_RULE_DATA = '+json.dumps(out,ensure_ascii=False,indent=2)+';\nexport const HOST_RULE_SOURCE_SHA256 = '+json.dumps(hashlib.sha256(raw).hexdigest())+';\n',encoding='utf-8',newline='\n')
print('Extracted',len(out),'selected rule entries:',', '.join(e['title'] for e in out))
