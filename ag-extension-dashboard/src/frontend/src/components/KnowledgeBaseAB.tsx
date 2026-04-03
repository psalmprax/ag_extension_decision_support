import { useDesign } from '@/hooks/useDesignVariant';
import { useLanguage } from '@/lib/LanguageContext';
import { Search, BookOpen, ChevronRight, Clock, ThumbsUp, Eye, Plus } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  category: string;
  readTime: string;
  likes: number;
  views: number;
}

interface KnowledgeBaseProps {
  articles: Article[];
  categories: string[];
  searchQuery: string;
  onSearch: (query: string) => void;
}

const CurrentKnowledgeBase: React.FC<KnowledgeBaseProps> = ({ articles, categories, searchQuery, onSearch }) => (
  <div className="flex h-full">
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>
      <div className="space-y-1">
        {categories.map((cat) => (
          <div key={cat} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded cursor-pointer">
            {cat}
          </div>
        ))}
      </div>
    </div>
    <div className="flex-1 p-4">
      <div className="text-lg font-semibold mb-4">Knowledge Base</div>
      <div className="grid grid-cols-2 gap-4">
        {articles.map((article) => (
          <div key={article.id} className="p-4 bg-white border border-gray-200 rounded hover:border-green-500 cursor-pointer">
            <div className="text-sm font-medium">{article.title}</div>
            <div className="text-xs text-gray-500 mt-2">{article.category}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const NewKnowledgeBase: React.FC<KnowledgeBaseProps> = ({ articles, categories, searchQuery, onSearch }) => {
  const { t } = useLanguage();
  
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Knowledge Base</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search articles..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-sm placeholder-gray-400 focus:ring-2 focus:ring-green-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Categories</p>
          <div className="space-y-1">
            {categories.map((cat, idx) => (
              <div
                key={cat}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors ${
                  idx === 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span>{cat}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-green-500/25">
            <Plus className="w-4 h-4" />
            New Article
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Popular Articles</h1>
          <p className="text-gray-500">Explore our most-read farming guides</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:shadow-lg hover:shadow-black/5 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                  {article.category}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 group-hover:text-green-600 transition-colors">
                {article.title}
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {article.readTime}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {article.likes}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {article.views}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const KnowledgeBaseAB: React.FC<KnowledgeBaseProps> = (props) => {
  const KB = useDesign({
    current: CurrentKnowledgeBase,
    new: NewKnowledgeBase,
  });
  return <KB {...props} />;
};

export default KnowledgeBaseAB;
