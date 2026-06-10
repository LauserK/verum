'use client';

import { useState, useEffect } from 'react';
import { adminApi, InventoryItem, UOMBase } from '@/lib/api';

export default function ItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    code: '', 
    type: 'raw_material', 
    base_uom_id: '' 
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [itemsData, uomsData] = await Promise.all([
        adminApi.getInventoryItems(),
        adminApi.getUOMBase()
      ]);
      setItems(itemsData);
      setUoms(uomsData);
      if (uomsData.length > 0) {
        setNewItem(prev => ({ ...prev, base_uom_id: uomsData[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await adminApi.createInventoryItem(newItem);
      setShowModal(false);
      setNewItem({ name: '', code: '', type: 'raw_material', base_uom_id: uoms[0]?.id || '' });
      loadData();
    } catch (error) {
      alert('Error al crear artículo');
    }
  }

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Maestro de Artículos</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Nuevo Artículo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="p-4 font-semibold text-gray-600">Código</th>
              <th className="p-4 font-semibold text-gray-600">Nombre</th>
              <th className="p-4 font-semibold text-gray-600">Tipo</th>
              <th className="p-4 font-semibold text-gray-600">UOM Base</th>
              <th className="p-4 font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                <td className="p-4 font-mono text-sm text-gray-500">{item.code || '-'}</td>
                <td className="p-4 font-medium text-gray-800">{item.name}</td>
                <td className="p-4">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 uppercase">
                    {item.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4 text-gray-600">
                  {uoms.find(u => u.id === item.base_uom_id)?.code || '---'}
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold ${item.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {item.is_active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">No hay artículos registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nuevo Artículo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  type="text" 
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  className="w-full border rounded-lg p-2"
                  placeholder="Ej: Harina de Trigo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código (opcional)</label>
                <input 
                  type="text" 
                  value={newItem.code}
                  onChange={e => setNewItem({...newItem, code: e.target.value})}
                  className="w-full border rounded-lg p-2"
                  placeholder="Ej: MAT-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select 
                  value={newItem.type}
                  onChange={e => setNewItem({...newItem, type: e.target.value})}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="raw_material">Materia Prima</option>
                  <option value="semi_finished">Semi-elaborado</option>
                  <option value="finished">Producto Terminado</option>
                  <option value="supply">Insumo / Suministro</option>
                  <option value="packaging">Empaque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida Base</label>
                <select 
                  value={newItem.base_uom_id}
                  onChange={e => setNewItem({...newItem, base_uom_id: e.target.value})}
                  className="w-full border rounded-lg p-2"
                >
                  {uoms.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
