import sys
import tempfile
import unittest
from pathlib import Path
from openpyxl import Workbook
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ckanext.nis_portal.excel_parser import extract, key

class Extraction(unittest.TestCase):
    def workbook(self, names):
        book = Workbook(); book.remove(book.active)
        for name in names:
            sheet = book.create_sheet(name); sheet.append(['Name', 'Value']); sheet.append(['កម្ពុជា', 12])
        file = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False); file.close(); book.save(file.name)
        self.addCleanup(Path(file.name).unlink)
        return Path(file.name)
    def template(self):
        return {'sheet':'7A1', 'name':'Khmer statistics', 'header':1, 'start':2, 'columns':[{'column':1,'id':'name','label':'ឈ្មោះ','expected':'Name','type':'text'},{'column':2,'id':'value','expected':'Value','type':'numeric'}]}
    def test_matching(self):
        for name in ['7A1',' 7 A1 ', '７Ａ１','7A1\u00a0']: self.assertEqual(key(name),'7a1')
        self.assertNotEqual(key('7A1 (2)'),key('7A1'))
        self.assertNotEqual(key('7A10'),key('7A1'))
    def test_extra_and_review(self):
        path = self.workbook(['7 A1', 'Other'])
        sheets=extract(path,[self.template()]); self.assertEqual([s['state'] for s in sheets],['ready','needs_review'])
        self.assertEqual(sheets[0]['records'][0]['name'],'កម្ពុជា')
        sheets=extract(path,[self.template()],{'Other':{'exclude':True}})
        self.assertEqual(sheets[1]['state'],'excluded')
    def test_collisions(self):
        sheets=extract(self.workbook(['7A1','7 A1']),[self.template()])
        self.assertTrue(all(s['state']=='needs_review' for s in sheets))
    def test_mismatch_hidden_formula(self):
        path=self.workbook(['7A1']); book=__import__('openpyxl').load_workbook(path); book.active['A1']='Wrong'; book.active.sheet_state='visible'; book.active['B2']='=1+2'; book.save(path)
        result=extract(path,[self.template()])[0]; self.assertEqual(result['state'],'needs_review'); self.assertTrue(any('cached' in w for w in result['warnings']))
    def test_hidden_empty_and_invisible(self):
        path=self.workbook(['7A1','Hidden','Empty'])
        book=__import__('openpyxl').load_workbook(path);book['Hidden'].sheet_state='hidden';book['Empty'].delete_rows(1,2);book.save(path)
        result=extract(path,[self.template()]);self.assertEqual(result[1]['state'],'needs_review');self.assertEqual(result[2]['state'],'empty')
        result=extract(self.workbook(['7A1\u200b']),[self.template()]);self.assertEqual(result[0]['state'],'needs_review');self.assertTrue(any('invisible' in w for w in result[0]['warnings']))
    def test_presets(self):
        root=Path(__file__).resolve().parents[3]
        if not (root/'11-upload/11A_1.xlsx').exists(): self.skipTest('Private local 11A fixtures are not installed')
        for file, expected in [('11A_1.xlsx',58),('11A2.xlsx',4),('11A3.xlsx',4)]:
            path=root/'11-upload'/file
            if not path.exists(): continue
            result=extract(path,[])[0]
            self.assertEqual(result['state'],'ready',result['warnings']);self.assertEqual(len(result['records']),expected)
            if file == '11A_1.xlsx':
                from collections import Counter
                self.assertEqual(Counter(r['year'] for r in result['records']),{None:19,2024:19,2023:20})
                self.assertTrue(any(r['indicator_code']=='11A5_1' for r in result['records']))

if __name__=='__main__': unittest.main()
