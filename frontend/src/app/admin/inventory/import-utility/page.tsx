'use client';

import { useState, useEffect } from 'react';
import { adminApi, ItemCategory, UOMBase, InventoryItem } from '@/lib/api';
import { 
  FileUp, 
  Save, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface ParsedRow {
  id: string;
  code: string;
  categoryName: string;
  categoryId: string | null;
  name: string;
  price: number;
  type: string;
  base_uom_id: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export default function ImportUtilityPage() {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [existingItems, setExistingItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ParsedRow[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [startRow, setStartRow] = useState<number>(2); 
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, uomList, items] = await Promise.all([
          adminApi.getItemCategories(),
          adminApi.getUOMBase(),
          adminApi.getInventoryItems()
        ]);
        setCategories(cats);
        setUoms(uomList);
        setExistingItems(items);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(wb.SheetNames[0]);
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (!workbook || !selectedSheet) return;

    const ws = workbook.Sheets[selectedSheet];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    const rows = json.slice(startRow - 1).map((row) => {
      const rawCatName = String(row[1] || '').trim();
      const upperCat = rawCatName.toUpperCase();
      
      // 1. Improved Category Matching (Case insensitive & Singular/Plural for Subrecetas)
      let matchedCat = categories.find(c => c.name.toLowerCase() === rawCatName.toLowerCase());
      
      if (!matchedCat && upperCat.includes('SUBRECETA')) {
          matchedCat = categories.find(c => c.name.toUpperCase().includes('SUBRECETA'));
      }
      if (!matchedCat && upperCat.includes('BEBIDA')) {
          matchedCat = categories.find(c => c.name.toUpperCase().includes('BEBIDA'));
      }
      if (!matchedCat && (upperCat.includes('EMPAQUE') || upperCat.includes('CONSUMIBLE'))) {
          matchedCat = categories.find(c => c.name.toUpperCase().includes('EMPAQUE') || c.name.toUpperCase().includes('CONSUMIBLE'));
      }

      // 2. Logic for Defaults based on category name in Excel
      let defaultType = 'raw_material';
      let defaultUomId = uoms[0]?.id || '';
      const unitUom = uoms.find(u => u.code.toLowerCase() === 'unit' || u.name.toLowerCase().includes('unidad'));

      if (upperCat.includes('SUBRECETA')) {
          defaultType = 'semi_finished';
      } else if (upperCat.includes('BEBIDA')) {
          defaultType = 'finished';
          if (unitUom) defaultUomId = unitUom.id;
      } else if (upperCat.includes('EMPAQUE') || upperCat.includes('CONSUMIBLE')) {
          defaultType = 'supply';
          if (unitUom) defaultUomId = unitUom.id;
      }
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        code: String(row[0] || '').trim(),
        categoryName: rawCatName,
        categoryId: matchedCat?.id || null,
        name: String(row[2] || '').trim(),
        price: Number(row[10]) || 0,
        type: defaultType, 
        base_uom_id: defaultUomId,
        status: 'pending' as const,
      };
    }).filter(r => r.name); 

    setData(rows);
  }, [workbook, selectedSheet, startRow, categories, uoms]);

  async function handleImport(mode: 'all' | 'categories_only') {
    const pending = data.filter(r => r.status !== 'success');
    
    if (mode === 'all') {
        const missingUom = pending.some(r => !r.base_uom_id);
        if (missingUom) {
            alert('Asegúrese de que todos los artículos tengan una Unidad Base asignada');
            return;
        }
    }
    
    setImporting(true);
    setProgress({ current: 0, total: data.length });

    const currentData = [...data];

    for (let i = 0; i < currentData.length; i++) {
      const row = currentData[i];
      if (row.status === 'success') continue;

      try {
        const existing = row.code ? existingItems.find(item => item.code === row.code) : null;

        if (mode === 'categories_only') {
            if (existing) {
                await adminApi.updateInventoryItem(existing.id, {
                    category_id: row.categoryId || null
                });
                currentData[i].status = 'success';
            } else {
                currentData[i].status = 'error';
                currentData[i].error = 'Artículo no encontrado para actualizar categoría';
            }
        } else {
            if (existing) {
                // Update price and category
                await adminApi.updateInventoryItem(existing.id, {
                    last_purchase_cost: row.price || null,
                    category_id: row.categoryId || null
                });
                currentData[i].status = 'success';
            } else {
                // Create new
                await adminApi.createInventoryItem({
                    name: row.name,
                    code: row.code || null,
                    type: row.type as any,
                    category_id: row.categoryId || null,
                    base_uom_id: row.base_uom_id,
                    last_purchase_cost: row.price || null
                });
                currentData[i].status = 'success';
            }
        }
      } catch (err: any) {
        currentData[i].status = 'error';
        currentData[i].error = err.message;
      }
      setData([...currentData]);
      setProgress(p => ({ ...p, current: i + 1 }));
    }
    setImporting(false);
    
    const updatedItems = await adminApi.getInventoryItems();
    setExistingItems(updatedItems);
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/inventory/items" className="p-2 hover:bg-surface-raised rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Utilidad de Importación Excel</h1>
          <p className="text-sm text-text-secondary mt-1">Herramienta temporal para carga masiva de artículos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm md:col-span-1">
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">Paso 1: Archivo y Hoja</label>
          <div className="space-y-4">
            <div className="relative group">
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group-hover:border-primary group-hover:bg-primary/5 transition-all duration-300">
                <FileUp className="w-6 h-6 text-primary" />
                <p className="text-xs text-text-primary font-bold">{workbook ? 'Archivo cargado' : 'Subir Excel'}</p>
              </div>
            </div>

            {workbook && (
              <div className="grid grid-cols-1 gap-3 animate-in fade-in duration-300">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Hoja</label>
                  <select 
                    value={selectedSheet}
                    onChange={e => setSelectedSheet(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-2 h-9 text-xs text-text-primary outline-none"
                  >
                    {sheetNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Desde Fila</label>
                  <input 
                    type="number"
                    min="1"
                    value={startRow}
                    onChange={e => setStartRow(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-3 h-9 text-xs text-text-primary outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm md:col-span-3">
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">Paso 2: Configuración Individual</label>
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 h-full flex items-center">
            <div className="space-y-2">
                <p className="text-sm text-text-primary leading-relaxed font-medium">
                Configure cada artículo directamente en la tabla inferior. 
                </p>
                <ul className="text-xs text-text-secondary space-y-1 list-disc ml-4">
                    <li><strong>Actualizar Categorías:</strong> Use el botón de la derecha para corregir categorías de productos existentes.</li>
                    <li><strong>Subrecetas:</strong> Se marcan como Semielaborados por defecto.</li>
                    <li><strong>Bebidas:</strong> Se marcan como Terminados y por Unidades.</li>
                    <li><strong>Empaque/Consumibles:</strong> Se marcan como Insumos y por Unidades.</li>
                </ul>
            </div>
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end px-2">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              Vista Previa
              <span className="text-xs font-medium bg-surface-raised px-2 py-0.5 rounded-full text-text-secondary border border-border">
                {data.length} artículos
              </span>
            </h2>
          </div>
          
          <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-surface-raised">
                  <tr className="border-b border-border">
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest w-16">Status</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Código</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Nombre</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Categoría</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Tipo</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">UOM</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Costo</th>
                    <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((row, idx) => {
                    const isUpdate = row.code && existingItems.some(item => item.code === row.code);
                    return (
                      <tr key={row.id} className={`hover:bg-surface-raised/40 transition-colors group ${isUpdate ? 'bg-primary/5' : ''}`}>
                        <td className="p-4 text-center">
                          {row.status === 'pending' && (
                            <div className={`w-2.5 h-2.5 rounded-full mx-auto animate-pulse ${isUpdate ? 'bg-primary' : 'bg-text-disabled'}`} />
                          )}
                          {row.status === 'success' && (
                            <CheckCircle2 className="w-5 h-5 text-success mx-auto" />
                          )}
                          {row.status === 'error' && (
                            <div className="relative group/error inline-block">
                              <AlertCircle className="w-5 h-5 text-error mx-auto cursor-help" />
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/error:block w-48 p-2 bg-error text-white text-[10px] rounded-lg shadow-xl z-30">
                                {row.error}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-error" />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col gap-1">
                            <input 
                              value={row.code}
                              onChange={e => {
                                const newData = [...data];
                                newData[idx].code = e.target.value;
                                setData(newData);
                              }}
                              placeholder="Sin código"
                              className="w-24 bg-transparent border border-transparent focus:border-primary focus:bg-surface rounded-xl px-2 h-10 text-xs text-text-primary outline-none transition-all font-mono"
                            />
                            {isUpdate && <span className="text-[8px] font-black text-primary uppercase ml-2 tracking-tighter">Actualizar</span>}
                          </div>
                        </td>
                        <td className="p-2">
                          <input 
                            value={row.name}
                            onChange={e => {
                              const newData = [...data];
                              newData[idx].name = e.target.value;
                              setData(newData);
                            }}
                            className="w-full bg-transparent border border-transparent focus:border-primary focus:bg-surface rounded-xl px-2 h-10 text-xs font-bold text-text-primary outline-none transition-all"
                          />
                        </td>
                        <td className="p-2">
                          <select 
                            value={row.categoryId || ''}
                            onChange={e => {
                              const newData = [...data];
                              newData[idx].categoryId = e.target.value;
                              setData(newData);
                            }}
                            className="w-full bg-transparent border border-transparent focus:border-primary focus:bg-surface rounded-xl px-2 h-10 text-[10px] text-text-secondary outline-none transition-all cursor-pointer appearance-none"
                          >
                            <option value="">(Sin categoría)</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <select 
                            value={row.type}
                            onChange={e => {
                              const newData = [...data];
                              newData[idx].type = e.target.value;
                              setData(newData);
                            }}
                            disabled={!!isUpdate && row.status === 'success'}
                            className="w-full bg-transparent border border-transparent focus:border-primary focus:bg-surface rounded-xl px-2 h-10 text-[10px] text-text-secondary outline-none transition-all cursor-pointer appearance-none disabled:opacity-30"
                          >
                            <option value="raw_material">Materia Prima</option>
                            <option value="semi_finished">Semielaborado</option>
                            <option value="finished">Terminado</option>
                            <option value="supply">Insumo</option>
                            <option value="packaging">Empaque</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select 
                            value={row.base_uom_id}
                            onChange={e => {
                              const newData = [...data];
                              newData[idx].base_uom_id = e.target.value;
                              setData(newData);
                            }}
                            disabled={!!isUpdate && row.status === 'success'}
                            className="w-full bg-transparent border border-transparent focus:border-primary focus:bg-surface rounded-xl px-2 h-10 text-[10px] text-text-secondary outline-none transition-all cursor-pointer appearance-none disabled:opacity-30"
                          >
                            <option value="">Seleccionar...</option>
                            {uoms.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-text-disabled text-[10px]">$</span>
                            <input 
                              type="number"
                              value={row.price}
                              onChange={e => {
                                const newData = [...data];
                                newData[idx].price = Number(e.target.value);
                                setData(newData);
                              }}
                              className="w-20 bg-transparent border border-transparent focus:border-primary focus:bg-surface rounded-xl pl-4 pr-1 h-10 text-xs text-text-primary outline-none transition-all font-bold"
                            />
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            onClick={() => setData(data.filter(r => r.id !== row.id))} 
                            className="p-2 text-text-disabled hover:text-error hover:bg-error/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 bg-surface-raised border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-text-primary font-bold">Resumen de Importación</p>
                <p className="text-xs text-text-secondary">
                  {data.filter(r => r.status === 'success').length} de {data.length} completados
                </p>
              </div>
              
              <div className="flex gap-3">
                <button 
                    onClick={() => handleImport('categories_only')}
                    disabled={importing || data.length === 0}
                    className="bg-surface border border-border text-text-primary px-6 h-14 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-surface-raised transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                >
                    {importing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                    <RefreshCw className="w-5 h-5" />
                    )}
                    Solo Categorías
                </button>

                <button 
                    onClick={() => handleImport('all')}
                    disabled={importing || data.length === 0}
                    className="w-full sm:w-auto bg-primary text-text-inverse px-10 h-14 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-primary-hover transition-all disabled:opacity-50 shadow-xl shadow-primary/20 active:scale-95"
                >
                    {importing ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Procesando ({progress.current}/{progress.total})
                    </>
                    ) : (
                    <>
                        <Save className="w-5 h-5" />
                        Ejecutar Carga Completa
                    </>
                    )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
