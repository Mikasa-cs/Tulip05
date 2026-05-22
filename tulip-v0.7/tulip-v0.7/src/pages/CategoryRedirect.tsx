import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const routeByCategory: Record<string, string> = {
  women: '/women',
  men: '/men',
  boys: '/boys',
  girls: '/girls',
  footwear: '/footwear',
  skincare: '/skincare',
  beauty: '/skincare',
  accessories: '/categories',
  kids: '/categories',
};

const CategoryRedirect: React.FC = () => {
  const { id } = useParams();
  const normalizedCategory = (id || '').trim().toLowerCase();
  const targetRoute = routeByCategory[normalizedCategory] || '/categories';

  return <Navigate to={targetRoute} replace />;
};

export default CategoryRedirect;
