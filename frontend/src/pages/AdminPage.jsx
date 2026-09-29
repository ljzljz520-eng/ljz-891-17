import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, Package, Pencil, Globe, Power } from 'lucide-react';
import Modal from '../components/Modal';

const emptyProduct = { name: '', version: '', website_url: '', is_enabled: true };

const deleteMeta = {
  license: {
    title: '确认删除授权',
    content: '您确定要删除此授权吗？删除后该用户将无法查询到授权信息，此操作不可恢复。'
  },
  product: {
    title: '确认删除产品',
    content: '您确定要删除此产品吗？删除后不可恢复。若产品下仍有关联授权将无法删除，建议选择停用。'
  },
  admin: {
    title: '确认删除管理员',
    content: '您确定要删除此管理员吗？删除后该账号将无法登录后台。'
  }
};

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [newLicense, setNewLicense] = useState({
    qq: '', owner_name: '', product_id: '', upline: '官方', expiration_date: ''
  });

  // Product State
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);

  // Modal State
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState('license'); // 'license' | 'product' | 'admin'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Admin Management State
  const [activeTab, setActiveTab] = useState('license'); // 'license' | 'product' | 'admin'
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });

  useEffect(() => {
    if (token) {
        fetchLicenses();
        fetchAdmins();
        fetchProducts();
    }
  }, [token]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredLicenses(licenses);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredLicenses(licenses.filter(l =>
        l.qq.includes(lower) ||
        l.owner_name.toLowerCase().includes(lower) ||
        (l.product_name || '').toLowerCase().includes(lower)
      ));
    }
  }, [searchTerm, licenses]);

  // 启用中的产品才可被新增授权选择
  const enabledProducts = products.filter(p => p.is_enabled);
  const visibleProducts = searchTerm
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.version || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : products;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('auth_token', res.data.token);
      setToken(res.data.token);
      toast.success('欢迎回来，管理员');
    } catch (err) {
      toast.error('登录失败: 用户名或密码错误');
    }
  };

  const fetchLicenses = async () => {
    try {
      const res = await axios.get('/api/license/list');
      setLicenses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdmins = async () => {
      try {
          const res = await axios.get('/api/auth/list');
          setAdmins(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const fetchProducts = async () => {
      try {
          const res = await axios.get('/api/product/list');
          setProducts(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'product') {
      cancelEditProduct();
    }
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setNewProduct(emptyProduct);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'license') {
          if (!newLicense.product_id) {
              toast.error('请选择所属产品');
              return;
          }
          await axios.post('/api/license/create', newLicense);
          toast.success('授权添加成功');
          setNewLicense({ qq: '', owner_name: '', product_id: '', upline: '官方', expiration_date: '' });
          fetchLicenses();
          fetchProducts(); // 同步产品关联授权数
      } else if (activeTab === 'product') {
          if (editingProductId) {
              await axios.post('/api/product/update', { id: editingProductId, ...newProduct });
              toast.success('产品已更新');
          } else {
              await axios.post('/api/product/create', newProduct);
              toast.success('产品添加成功');
          }
          cancelEditProduct();
          fetchProducts();
      } else {
          await axios.post('/api/auth/create', newAdmin);
          toast.success('管理员添加成功');
          setNewAdmin({ username: '', password: '' });
          fetchAdmins();
      }
    } catch (err) {
      toast.error('操作失败：' + (err.response?.data?.message || '网络错误'));
    }
  };

  const handleEditProduct = (product) => {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      version: product.version || '',
      website_url: product.website_url || '',
      is_enabled: !!product.is_enabled
    });
  };

  const handleToggleProduct = async (product) => {
    try {
      await axios.post('/api/product/update', {
        id: product.id,
        name: product.name,
        version: product.version || '',
        website_url: product.website_url || '',
        is_enabled: product.is_enabled ? 0 : 1
      });
      toast.success(product.is_enabled ? `已停用「${product.name}」，不可再新增授权` : `已启用「${product.name}」`);
      // 若正在编辑该产品，同步表单中的启用状态
      if (editingProductId === product.id) {
        setNewProduct(prev => ({ ...prev, is_enabled: !product.is_enabled }));
      }
      fetchProducts();
    } catch (err) {
      toast.error('操作失败：' + (err.response?.data?.message || '网络错误'));
    }
  };

  const confirmDelete = (id, type = 'license') => {
    setDeleteId(id);
    setDeleteType(type);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      if (deleteType === 'license') {
          await axios.post('/api/license/delete', { id: deleteId });
          toast.success('已删除该授权');
          fetchLicenses();
          fetchProducts(); // 同步产品关联授权数
      } else if (deleteType === 'product') {
          await axios.post('/api/product/delete', { id: deleteId });
          toast.success('已删除该产品');
          fetchProducts();
      } else {
          await axios.post('/api/auth/delete', { id: deleteId });
          toast.success('已删除该管理员');
          fetchAdmins();
      }
    } catch(err) {
      toast.error(err.response?.data?.message || '删除失败');
    }
  };

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md glass-card p-10 animate-fade-in-up">
           <div className="text-center mb-8">
             <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sky-400">
               <Lock size={32} />
             </div>
             <h2 className="text-2xl font-bold text-white">管理员登录</h2>
             <p className="text-white/40 mt-2 text-sm">请输入您的管理凭证以继续</p>
           </div>

           <form onSubmit={handleLogin} className="space-y-5">
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">账号</label>
               <div className="relative group">
                 <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="Administrator" />
                 <User className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">密码</label>
               <div className="relative group">
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="••••••••" />
                 <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <button type="submit" className="tech-button w-full mt-2 !py-3 !text-sm tracking-widest">登录</button>
           </form>
        </div>
      </div>
    );
  }

  const formTitle = activeTab === 'license'
    ? '新增授权'
    : activeTab === 'product'
      ? (editingProductId ? '编辑产品' : '新增产品')
      : '新增管理员';

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-sky-300">
            授权管理中心
          </h1>
          <p className="text-white/40 mt-1">System Administration Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative">
             <input
                type="text"
                placeholder="搜索QQ、主人或产品..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
             />
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
           </div>
           <button onClick={() => {localStorage.removeItem('auth_token'); setToken(null);}} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition border border-white/5 hover:border-red-500/30">
             退出登录
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Add Form */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <div className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <Plus className="w-4 h-4"/>
                </div>
                {formTitle}
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                 {activeTab === 'license' && (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权QQ</label>
                            <input required className="glass-input w-full" placeholder="输入QQ号" value={newLicense.qq} onChange={e=>setNewLicense({...newLicense, qq:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权主人</label>
                            <input required className="glass-input w-full" placeholder="输入名称" value={newLicense.owner_name} onChange={e=>setNewLicense({...newLicense, owner_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">所属产品</label>
                            <select
                                required
                                className="glass-input w-full appearance-none cursor-pointer"
                                value={newLicense.product_id}
                                onChange={e=>setNewLicense({...newLicense, product_id:e.target.value})}
                            >
                                <option value="" disabled className="bg-slate-900">请选择产品</option>
                                {enabledProducts.map(p => (
                                    <option key={p.id} value={p.id} className="bg-slate-900">
                                        {p.name}{p.version ? ` (${p.version})` : ''}
                                    </option>
                                ))}
                            </select>
                            {enabledProducts.length === 0 && (
                                <p className="text-xs text-amber-400/80">暂无启用中的产品，请先在「产品管理」中添加并启用</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权上级</label>
                            <input required className="glass-input w-full" placeholder="默认：官方" value={newLicense.upline} onChange={e=>setNewLicense({...newLicense, upline:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">过期时间</label>
                            <input required type="datetime-local" className="glass-input w-full" value={newLicense.expiration_date} onChange={e=>setNewLicense({...newLicense, expiration_date:e.target.value})} />
                        </div>
                     </>
                 )}
                 {activeTab === 'product' && (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">产品名称</label>
                            <input required className="glass-input w-full" placeholder="例如：授权平台" value={newProduct.name} onChange={e=>setNewProduct({...newProduct, name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">产品版本</label>
                            <input className="glass-input w-full" placeholder="例如：v1.0.0" value={newProduct.version} onChange={e=>setNewProduct({...newProduct, version:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">官网链接</label>
                            <input className="glass-input w-full" placeholder="https://example.com" value={newProduct.website_url} onChange={e=>setNewProduct({...newProduct, website_url:e.target.value})} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                            <input type="checkbox" checked={newProduct.is_enabled} onChange={e=>setNewProduct({...newProduct, is_enabled:e.target.checked})} className="w-4 h-4 accent-sky-500" />
                            <span className="text-xs text-white/60">启用该产品（停用后不可新增授权）</span>
                        </label>
                     </>
                 )}
                 {activeTab === 'admin' && (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">用户名</label>
                            <input required className="glass-input w-full" placeholder="输入新管理员账号" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">密码</label>
                            <input required type="text" className="glass-input w-full" placeholder="设置初始密码" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password:e.target.value})} />
                        </div>
                     </>
                 )}
                 <div className="pt-2 space-y-2">
                    <button type="submit" className="tech-button w-full flex justify-center items-center gap-2">
                      <Plus size={16} />
                      {activeTab === 'license' ? '立即授权' : activeTab === 'product' ? (editingProductId ? '保存修改' : '添加产品') : '添加管理员'}
                    </button>
                    {activeTab === 'product' && editingProductId && (
                      <button type="button" onClick={cancelEditProduct} className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition border border-white/10 text-sm">
                        取消编辑
                      </button>
                    )}
                 </div>
              </form>
          </div>
        </div>

        {/* Main: Details List */}
        <div className="lg:col-span-3">
           <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
             <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 flex-wrap gap-3">
                 <h3 className="font-bold flex items-center gap-2">
                    {activeTab === 'license' && <Sliders size={18} className="text-sky-400"/>}
                    {activeTab === 'product' && <Package size={18} className="text-sky-400"/>}
                    {activeTab === 'admin' && <Shield size={18} className="text-sky-400"/>}
                    {activeTab === 'license' ? '授权列表' : activeTab === 'product' ? '产品列表' : '管理员列表'}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
                        {activeTab === 'license' ? filteredLicenses.length : activeTab === 'product' ? visibleProducts.length : admins.length}
                    </span>
                 </h3>
                 <div className="flex space-x-2">
                    <button
                        onClick={() => switchTab('license')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Users className="inline-block w-4 h-4 mr-2" /> 授权管理
                    </button>
                    <button
                        onClick={() => switchTab('product')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'product' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Package className="inline-block w-4 h-4 mr-2" /> 产品管理
                    </button>
                    <button
                        onClick={() => switchTab('admin')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Shield className="inline-block w-4 h-4 mr-2" /> 管理员管理
                    </button>
                 </div>
             </div>
             <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      {activeTab === 'license' && (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">授权QQ</th>
                            <th className="p-4">授权信息</th>
                            <th className="p-4">产品/上级</th>
                            <th className="p-4">状态/时间</th>
                          </>
                      )}
                      {activeTab === 'product' && (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">产品名称/官网</th>
                            <th className="p-4">版本</th>
                            <th className="p-4">状态/关联授权</th>
                          </>
                      )}
                      {activeTab === 'admin' && (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">管理员账号</th>
                            <th className="p-4">创建时间/状态</th>
                            <th className="p-4"></th>
                            <th className="p-4"></th>
                          </>
                      )}

                      <th className="p-4 text-right">管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {/* 授权列表 */}
                    {activeTab === 'license' && (
                      filteredLicenses.length === 0 ? (
                       <tr>
                         <td colSpan="6" className="p-12 text-center text-white/30">
                            暂无数据
                         </td>
                       </tr>
                      ) : (
                      filteredLicenses.map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                          <td className="p-4">
                              <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                                  {item.qq.slice(0, 2)}
                              </div>
                              <span className="text-sky-300 font-medium font-mono">{item.qq}</span>
                              </div>
                          </td>
                          <td className="p-4">
                              <div className="text-sm font-medium">{item.owner_name}</div>
                          </td>
                          <td className="p-4">
                              <div className="text-sm flex items-center gap-1.5 flex-wrap">
                                {item.product_name || <span className="text-white/30">未关联产品</span>}
                                {item.product_version && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] border border-sky-500/20 font-mono">{item.product_version}</span>
                                )}
                              </div>
                              <div className="text-xs text-white/40 mt-0.5">{item.upline}</div>
                          </td>
                          <td className="p-4">
                              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-1">
                              正常
                              </div>
                              <div className="text-xs text-white/40 font-mono">
                              {new Date(item.expiration_date).toLocaleDateString()}
                              </div>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => confirmDelete(item.id, 'license')}
                              className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                      )
                    )}

                    {/* 产品列表 */}
                    {activeTab === 'product' && (
                      visibleProducts.length === 0 ? (
                       <tr>
                         <td colSpan="6" className="p-12 text-center text-white/30">
                            暂无产品，请在左侧添加
                         </td>
                       </tr>
                      ) : (
                      visibleProducts.map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                          <td className="p-4">
                              <div className="text-sm font-medium">{item.name}</div>
                              {item.website_url ? (
                                <a href={item.website_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400/70 hover:text-sky-300 flex items-center gap-1 mt-0.5 break-all">
                                  <Globe size={10} className="shrink-0" /> {item.website_url}
                                </a>
                              ) : (
                                <div className="text-xs text-white/30 mt-0.5">未设置官网</div>
                              )}
                          </td>
                          <td className="p-4">
                              {item.version
                                ? <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-xs border border-sky-500/20 font-mono">{item.version}</span>
                                : <span className="text-white/30 text-xs">-</span>}
                          </td>
                          <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border mb-1 ${item.is_enabled ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                {item.is_enabled ? '启用中' : '已停用'}
                              </span>
                              <div className="text-xs text-white/40">{item.license_count} 个关联授权</div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => handleEditProduct(item)}
                                className="text-white/20 hover:text-sky-400 p-2 rounded-lg hover:bg-sky-500/10 transition"
                                title="编辑"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleProduct(item)}
                                className={`p-2 rounded-lg transition ${item.is_enabled ? 'text-white/20 hover:text-amber-400 hover:bg-amber-500/10' : 'text-white/20 hover:text-green-400 hover:bg-green-500/10'}`}
                                title={item.is_enabled ? '停用（停用后不可新增授权）' : '启用'}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => confirmDelete(item.id, 'product')}
                                className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                      )
                    )}

                    {/* 管理员列表 */}
                    {activeTab === 'admin' && (
                      admins.length === 0 ? (
                       <tr>
                         <td colSpan="6" className="p-12 text-center text-white/30">
                            暂无数据
                         </td>
                       </tr>
                      ) : (
                      admins.map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                          <td className="p-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                                      <User size={14} />
                                  </div>
                                  <span className="text-white font-medium">{item.username}</span>
                              </div>
                          </td>
                          <td className="p-4 text-xs text-white/40">管理员</td>
                          <td className="p-4"></td>
                          <td className="p-4"></td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => confirmDelete(item.id, 'admin')}
                              className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination or Footer (Simple) */}
              <div className="p-4 border-t border-white/5 text-xs text-white/30 text-center">
                End of List
              </div>
            </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        title={deleteMeta[deleteType].title}
        type="danger"
        content={deleteMeta[deleteType].content}
      />
    </div>
  );
}
