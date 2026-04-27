// src/presentation/categorias-libros/categorias-libros.service.ts

import { CategoriasLibrosRepository } from "./categoria-libro.repositorio";

export class CategoriasLibrosService {
  constructor(private readonly repo = new CategoriasLibrosRepository()) {}

  createCategoria(data: { nombre: string; descripcion?: string | null }) {
    return this.repo.createCategoria(data);
  }
  listCategorias() {
    return this.repo.listCategorias();
  }

  createSubcategoria(data: {
    categoriaId: string;
    nombre: string;
    descripcion?: string | null;
  }) {
    return this.repo.createSubcategoria(data);
  }
  listSubcategorias() {
    return this.repo.listSubcategorias();
  }
  listSubcategoriasPorCategoria(categoriaId: string) {
    return this.repo.listSubcategoriasPorCategoria(categoriaId);
  }
}
