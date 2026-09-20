import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { chamaService } from '../../services/chamaService';
import { Chama, ChamaType } from '../../types';
import { Search, Filter, Users, DollarSign } from 'lucide-react';

export const DiscoverChamas = () => {
  const [chamas, setChamas] = useState<Chama[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningChamaId, setJoiningChamaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<ChamaType | ''>('');

  const loadChamas = useCallback(async () => {
    try {
      const data = await chamaService.discoverChamas();
      setChamas(data);
    } catch (error) {
      console.error('Failed to load chamas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChamas();
  }, [loadChamas]);

  const filteredChamas = useMemo(() => {
    let filtered = chamas;

    if (searchTerm) {
      filtered = filtered.filter((chama) =>
        chama.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chama.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter) {
      filtered = filtered.filter((chama) => chama.type === typeFilter);
    }

    return filtered;
  }, [chamas, searchTerm, typeFilter]);

  const handleJoinChama = async (chamaId: string) => {
    try {
      setJoiningChamaId(chamaId);
      await chamaService.joinChama(chamaId);
      alert('Join request sent successfully!');
      void loadChamas();
    } catch (error: any) {
      console.error('Failed to join chama:', error);
      const serverMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        '';

      if (error?.response?.status === 409) {
        alert(serverMessage || 'You already have a pending or active membership for this chama.');
      } else {
        alert(serverMessage || 'Failed to send join request');
      }
    } finally {
      setJoiningChamaId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div style={{ color: 'var(--muted)' }}>Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="fade-up">
          <h1 className="text-3xl font-bold">Discover Organizations</h1>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>Find and join community groups that match your goals</p>
        </div>

        {/* Filters */}
        <div className="panel p-6 fade-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-with-icon"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--muted)' }} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ChamaType | '')}
                className="input input-with-icon appearance-none"
              >
                <option value="">All Organization Types</option>
                <option value="ROSCA">ROSCA</option>
                <option value="ASCA">ASCA</option>
                <option value="NORMAL">NORMAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chamas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChamas.map((chama) => (
            <div
              key={chama.id}
              className="panel overflow-hidden hover:shadow-xl transition-shadow lively-card"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{chama.name}</h3>
                    <span className="pill">
                      {chama.type}
                    </span>
                  </div>
                </div>

                <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--muted)' }}>{chama.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                    <Users className="w-4 h-4" />
                    <span>
                      {chama.currentMembers}/{chama.maxMembers} members
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                    <DollarSign className="w-4 h-4" />
                    <span>
                      {chama.currency} {chama.contributionAmount} / {chama.contributionFrequency}
                    </span>
                  </div>
                </div>

                <div className="badge-row mb-4">
                  <span className="badge">Fast approvals</span>
                  <span className="badge hot">Top pick</span>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/chamas/${chama.id}`}
                    className="btn btn-outline flex-1"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => handleJoinChama(chama.id)}
                    disabled={joiningChamaId === chama.id}
                    className="btn btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {joiningChamaId === chama.id ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredChamas.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)' }}>No organizations found matching your criteria</p>
          </div>
        )}
      </div>
    </Layout>
  );
};






