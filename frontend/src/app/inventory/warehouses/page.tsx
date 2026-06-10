'use client';

import { useState, useEffect } from 'react';
import { adminApi, Warehouse } from '@/lib/api';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', type: 'storage' });

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouses() {
    try {
      const data = await adminApi.getInventoryWarehouses();
      setWarehouses(data);
    } catch (error) {
      console.error('Error loading warehouses:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await adminApi.createInventoryWarehouse(newWarehouse);
      setShowModal(false);
      setNewWarehouse({ name: '', type: 'storage' });
      loadWarehouses();
    } catch (error) {
      alert('Error al crear almacén');
    }
  }

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Almacenes</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Nuevo Almacén
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(wh => (
          <div key={wh.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-lg">{wh.name}</h3>
            <p className="text-gray-500 text-sm uppercase tracking-wider">{wh.type}</p>
            <div className="mt-4 flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${wh.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">{wh.is_active ? 'Activo' : 'Inactivo'}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nuevo Almacén</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  type="text" 
                  value={newWarehouse.name}
                  onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})}
                  className="w-full border rounded-lg p-2"
                  placeholder="Ej: Bodega Principal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select 
                  value={newWarehouse.type}
                  onChange={e => setNewWarehouse({...newWarehouse, type: e.target.value})}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="storage">Almacenaje</option>
                  <option value="production">Producción / Cocina</option>
                  <option value="point_of_sale">Punto de Venta</option>
                  <option value="transit">Tránsito</option>
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
