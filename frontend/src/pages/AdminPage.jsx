import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, Package, Pencil, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import Modal from '../components/Modal';

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // 产品管理
  const [products, setProducts] = useState([]);
  const [activeProducts, setActiveProducts] = useState([]);

  const [newLicense, setNewLicense] = useState({
    qq: '', owner_name: '', product_id: '', upline: '官方', expiration_date: ''
  });

  const [newProduct, setNewProduct] = useState({
    name: '', version: '', website: '', is_active: true
  });
  const [editingProductId, setEditingProductId] = useState(null);

  // Modal State
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState('license'); // 'license' | 'admin' | 'product'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Admin Management State
  const [activeTab, setActiveTab] = useState('license'); // 'license' | 'admin' | 'product'
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
        (l.product_name && l.product_name.toLowerCase().includes(lower))
      ));
    }
  }, [searchTerm, licenses]);

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

  const fetchProducts = async () => {
    try {
      const [allRes, activeRes] = await Promise.all([
        axios.get('/api/product/list'),
        axios.get('/api/product/active')
      ]);
      setProducts(allRes.data);
      setActiveProducts(activeRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetProductForm = () => {
    setNewProduct({ name: '', version: '', website: '', is_active: true });
    setEditingProductId(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'license') {
          await axios.post('/api/license/create', newLicense);
          toast.success('授权添加成功');
          setNewLicense({ qq: '', owner_name: '', product_id: '', upline: '官方', expiration_date: '' });
          fetchLicenses();
      } else if (activeTab === 'product') {
          if (editingProductId) {
              await axios.post('/api/product/update', { id: editingProductId, ...newProduct });
              toast.success('产品更新成功');
          } else {
              await axios.post('/api/product/create', newProduct);
              toast.success('产品添加成功');
          }
          resetProductForm();
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
    setActiveTab('product');
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      version: product.version || '',
      website: product.website || '',
      is_active: !!product.is_active
    });
  };

  const handleToggleProduct = async (product) => {
    try {
      await axios.post('/api/product/toggle', { id: product.id });
      toast.success(product.is_active ? `已停用「${product.name}」` : `已启用「${product.name}」`);
      fetchProducts();
    } catch (err) {
      toast.error('状态切换失败');
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
      toast.error('删除失败：' + (err.response?.data?.message || '网络错误'));
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
                {activeTab === 'license' ? '新增授权' : activeTab === 'product' ? (editingProductId ? '编辑产品' : '新增产品') : '新增管理员'}
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                 {activeTab === 'license' ? (
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
                                className="glass-input w-full"
                                value={newLicense.product_id}
                                onChange={e=>setNewLicense({...newLicense, product_id:e.target.value})}
                            >
                                <option value="">请选择产品</option>
                                {activeProducts.length === 0 && (
                                    <option value="" disabled>暂无可用产品，请先在产品管理中添加</option>
                                )}
                                {activeProducts.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{p.version ? `（${p.version}）` : ''}
                                    </option>
                                ))}
                            </select>
                            {activeProducts.length === 0 && (
                                <p className="text-xs text-amber-400/70 mt-1">暂无启用的产品，请先到「产品管理」添加并启用。</p>
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
                 ) : activeTab === 'product' ? (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">产品名称</label>
                            <input required className="glass-input w-full" placeholder="例如：超级授权系统VIP版" value={newProduct.name} onChange={e=>setNewProduct({...newProduct, name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">版本</label>
                            <input className="glass-input w-full" placeholder="例如：v1.0.0" value={newProduct.version} onChange={e=>setNewProduct({...newProduct, version:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">官网链接</label>
                            <input className="glass-input w-full" placeholder="https://example.com" value={newProduct.website} onChange={e=>setNewProduct({...newProduct, website:e.target.value})} />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <label className="text-xs text-white/40">是否启用</label>
                            <button
                                type="button"
                                onClick={() => setNewProduct({...newProduct, is_active: !newProduct.is_active})}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                                    newProduct.is_active
                                        ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                        : 'bg-white/5 text-white/40 border-white/10'
                                }`}
                            >
                                {newProduct.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                {newProduct.is_active ? '启用中' : '已停用'}
                            </button>
                        </div>
                     </>
                 ) : (
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
                 <div className="pt-2 flex gap-2">
                    <button type="submit" className="tech-button flex-1 flex justify-center items-center gap-2">
                      <Plus size={16} /> {activeTab === 'license' ? '立即授权' : activeTab === 'product' ? (editingProductId ? '保存修改' : '添加产品') : '添加管理员'}
                    </button>
                    {activeTab === 'product' && editingProductId && (
                        <button
                            type="button"
                            onClick={resetProductForm}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition border border-white/10"
                        >
                            取消
                        </button>
                    )}
                 </div>
              </form>
          </div>
        </div>

        {/* Main: Details List */}
        <div className="lg:col-span-3">
           <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
             <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <h3 className="font-bold flex items-center gap-2">
                    {activeTab === 'license' ? <Sliders size={18} className="text-sky-400"/> : activeTab === 'product' ? <Package size={18} className="text-sky-400"/> : <Shield size={18} className="text-sky-400"/>}
                    {activeTab === 'license' ? '授权列表' : activeTab === 'product' ? '产品列表' : '管理员列表'}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
                        {activeTab === 'license' ? filteredLicenses.length : activeTab === 'product' ? products.length : admins.length}
                    </span>
                 </h3>
                 <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('license')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Users className="inline-block w-4 h-4 mr-2" /> 授权管理
                    </button>
                    <button
                        onClick={() => setActiveTab('product')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'product' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Package className="inline-block w-4 h-4 mr-2" /> 产品管理
                    </button>
                    <button
                        onClick={() => setActiveTab('admin')}
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
                      {activeTab === 'license' ? (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">授权QQ</th>
                            <th className="p-4">授权信息</th>
                            <th className="p-4">产品/上级</th>
                            <th className="p-4">状态/时间</th>
                          </>
                      ) : activeTab === 'product' ? (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">产品名称</th>
                            <th className="p-4">版本</th>
                            <th className="p-4">官网链接</th>
                            <th className="p-4">状态</th>
                            <th className="p-4">创建时间</th>
                          </>
                      ) : (
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
                    {(activeTab === 'license' ? filteredLicenses : activeTab === 'product' ? products : admins).length === 0 ? (
                       <tr>
                         <td colSpan="7" className="p-12 text-center text-white/30">
                            暂无数据
                         </td>
                       </tr>
                    ) : (
                      (activeTab === 'license' ? filteredLicenses : activeTab === 'product' ? products : admins).map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          {activeTab === 'license' ? (
                              <>
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
                                    <div className="text-sm">{item.product_name || <span className="text-white/30">—</span>}</div>
                                    <div className="text-xs text-white/40 mt-0.5">
                                      {item.product_version ? `${item.product_version} · ` : ''}{item.upline}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-1">
                                    正常
                                    </div>
                                    <div className="text-xs text-white/40 font-mono">
                                    {new Date(item.expiration_date).toLocaleDateString()}
                                    </div>
                                </td>
                              </>
                          ) : activeTab === 'product' ? (
                              <>
                                <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">
                                            <Package size={14} />
                                        </div>
                                        <span className="text-white font-medium">{item.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-sky-300/80 font-mono">{item.version || '—'}</td>
                                <td className="p-4 text-sm">
                                    {item.website ? (
                                        <a
                                            href={item.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition"
                                        >
                                            <ExternalLink size={13} />
                                            <span className="underline underline-offset-4 truncate max-w-[180px]">{item.website}</span>
                                        </a>
                                    ) : <span className="text-white/30">—</span>}
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => handleToggleProduct(item)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                                            item.is_active
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                                        }`}
                                        title="点击切换启用/停用"
                                    >
                                        {item.is_active ? <ToggleRight size={13}/> : <ToggleLeft size={13}/>}
                                        {item.is_active ? '启用中' : '已停用'}
                                    </button>
                                </td>
                                <td className="p-4 text-xs text-white/40 font-mono">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </td>
                              </>
                          ) : (
                              <>
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
                              </>
                          )}

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {activeTab === 'product' && (
                                <button
                                  onClick={() => handleEditProduct(item)}
                                  className="text-white/20 hover:text-sky-400 p-2 rounded-lg hover:bg-sky-500/10 transition opacity-0 group-hover:opacity-100"
                                  title="编辑"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => confirmDelete(item.id, activeTab === 'product' ? 'product' : activeTab)}
                                className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
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
        title={deleteType === 'license' ? "确认删除授权" : deleteType === 'product' ? "确认删除产品" : "确认删除管理员"}
        type="danger"
        content={deleteType === 'license'
            ? "您确定要删除此授权吗？删除后该用户将无法查询到授权信息，此操作不可恢复。"
            : deleteType === 'product'
            ? "您确定要删除此产品吗？删除后不可恢复。若产品下仍有授权，将无法删除，建议改为停用。"
            : "您确定要删除此管理员吗？删除后该账号将无法登录后台。"
        }
      />
    </div>
  );
}
