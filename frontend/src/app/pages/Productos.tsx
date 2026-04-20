import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  Check,
  Package,
  Eye,
  Pencil,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export function Productos() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Estados para modales
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isViewCategoryOpen, setIsViewCategoryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [viewingCategory, setViewingCategory] = useState<any>(null);

  // Estados para formularios
  const [newProductName, setNewProductName] = useState("Refresco Cola");
  const [newProductCategory, setNewProductCategory] = useState("2");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryProfit, setNewCategoryProfit] = useState("10");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCategory, setSearchCategory] = useState("");

  // Estados para alertas
  const [deleteAlert, setDeleteAlert] = useState<{
    isOpen: boolean;
    productId: number | null;
    productName: string;
    hasStock: boolean;
  }>({ isOpen: false, productId: null, productName: "", hasStock: false });

  const [deleteCategoryAlert, setDeleteCategoryAlert] = useState<{
    isOpen: boolean;
    categoryId: number | null;
    categoryName: string;
    hasProducts: boolean;
  }>({ isOpen: false, categoryId: null, categoryName: "", hasProducts: false });

  const [successMessage, setSuccessMessage] = useState(false);

  const selectedCategoryData = categories.find(
    (cat) => cat.id === selectedCategory,
  );
  const filteredProducts = products.filter(
    (p) => p.categoryId === selectedCategory,
  );
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchCategory.toLowerCase()),
  );

  const fetchCategories = async () => {
    try {
      const response = await api.get(
        "http://localhost:8000/api/catalogo/categorias/",
      );
      const data = response.data.results ?? response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get(
        "http://localhost:8000/api/catalogo/productos/",
      );
      const data = response.data.results ?? response.data;
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();

    const handleBack = () => {
      setSelectedCategory(null);
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, []);

  const handleDeleteClick = (product: any) => {
    setDeleteAlert({
      isOpen: true,
      productId: product.id,
      productName: product.name,
      hasStock: product.stock > 0,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteAlert.productId) {
      try {
        await api.delete(
          `http://localhost:8000/api/catalogo/productos/C${deleteAlert.productId}/`,
        );
        setProducts(products.filter((p) => p.id !== deleteAlert.productId));
        setDeleteAlert({
          isOpen: false,
          productId: null,
          productName: "",
          hasStock: false,
        });
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    setIsEditProductOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editingProduct) {
      try {
        const payload = {
          name: editingProduct.name,
          categoryId: parseInt(editingProduct.categoryId),
        };
        const response = await api.patch(
          `http://localhost:8000/api/catalogo/productos/C${editingProduct.id}/`,
          payload,
        );
        fetchProducts(); // Refresh to get calculated fields like stock/price
        setIsEditProductOpen(false);
        setEditingProduct(null);
      } catch (error) {
        console.error("Error updating product:", error);
      }
    }
  };

  const handleAddProduct = async () => {
    try {
      const payload = {
        name: newProductName,
        categoryId: parseInt(newProductCategory),
      };
      await api.post("http://localhost:8000/api/catalogo/productos/", payload);
      fetchProducts();
      fetchCategories(); // Update product counts
      setIsAddProductOpen(false);
      setNewProductName("Refresco Cola");
      setNewProductCategory("2");
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      try {
        const payload = {
          name: newCategoryName,
          profitPercentage: parseFloat(newCategoryProfit) || 3,
        };
        await api.post(
          "http://localhost:8000/api/catalogo/categorias/",
          payload,
        );
        fetchCategories();
        setIsAddCategoryOpen(false);
        setNewCategoryName("");
        setNewCategoryProfit("3");
      } catch (error) {
        console.error("Error adding category:", error);
      }
    }
  };

  const handleViewCategoryClick = () => {
    if (selectedCategoryData) {
      setViewingCategory(selectedCategoryData);
      setIsViewCategoryOpen(true);
    }
  };

  const handleEditCategoryClick = () => {
    if (selectedCategoryData) {
      setEditingCategory(selectedCategoryData);
      setIsEditCategoryOpen(true);
    }
  };

  const handleDeleteCategoryClick = () => {
    if (selectedCategoryData) {
      setDeleteCategoryAlert({
        isOpen: true,
        categoryId: selectedCategoryData.id,
        categoryName: selectedCategoryData.name,
        hasProducts: selectedCategoryData.productCount > 0,
      });
    }
  };

  const handleSaveEditCategory = async () => {
    if (editingCategory) {
      try {
        const payload = {
          name: editingCategory.name,
          profitPercentage: parseFloat(editingCategory.profitPercentage) || 3,
        };
        await api.patch(
          `http://localhost:8000/api/catalogo/categorias/C${editingCategory.id}/`,
          payload,
        );
        fetchCategories();
        setIsEditCategoryOpen(false);
        setEditingCategory(null);
      } catch (error) {
        console.error("Error editing category:", error);
      }
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (deleteCategoryAlert.categoryId) {
      try {
        await api.delete(
          `http://localhost:8000/api/catalogo/categorias/C${deleteCategoryAlert.categoryId}/`,
        );
        setCategories(
          categories.filter((cat) => cat.id !== deleteCategoryAlert.categoryId),
        );
        setDeleteCategoryAlert({
          isOpen: false,
          categoryId: null,
          categoryName: "",
          hasProducts: false,
        });
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } catch (error) {
        console.error("Error deleting category:", error);
      }
    }
  };

  const searchedProducts = filteredProducts.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Productos</h1>
          <p className="text-gray-600">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setIsAddCategoryOpen(true)}
            className="bg-gradient-to-r from-blue-800 to-slate-900 hover:from-blue-900 hover:to-slate-950"
          >
            <Plus className="size-4 mr-2" />
            Agregar Categoría
          </Button>
          <Button
            onClick={() => setIsAddProductOpen(true)}
            className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950"
          >
            <Plus className="size-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {successMessage && (
        <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center">
              <Check className="size-6 text-white" />
            </div>
            <p className="font-semibold text-green-800">
              Producto eliminado con éxito
            </p>
          </div>
        </Card>
      )}

      {/* Vista de categorías o tabla de productos */}
      {selectedCategory === null ? (
        <div>
          <Card className="p-6 mb-6 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Categorías</h2>
              <div className="relative flex-1 max-w-md ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Buscar categorías..."
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <Card
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    window.history.pushState({}, "");
                  }}
                  className="p-6 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-slate-300 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="size-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Package className="size-6 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-gradient-to-r from-slate-100 to-gray-200 text-slate-800 rounded-full text-sm font-bold">
                      {category.productCount}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {category.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "producto" : "productos"}
                  </p>
                </Card>
              ))
            ) : (
              <p className="col-span-full text-center text-gray-500">
                No se encontraron categorías
              </p>
            )}
          </div>
        </div>
      ) : (
        <Card className="p-6 border-0 shadow-lg">
          {/* Header de la categoría */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {selectedCategoryData?.name}
              </h2>
              <p className="text-sm text-gray-600">
                {filteredProducts.length} productos en esta categoría
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewCategoryClick}
              >
                <Eye className="size-4" />
              </Button>

              <Button variant="outline" onClick={handleEditCategoryClick}>
                <Pencil className="size-4 mr-2" />
              </Button>

              <Button
                variant="outline"
                onClick={handleDeleteCategoryClick}
                className="bg-white border-red-500 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="size-4 mr-2" />
              </Button>
            </div>
          </div>

          {/* Buscador de productos */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <Input
                placeholder="Buscar productos por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Producto</TableHead>
                  <TableHead>Stock Disponible</TableHead>
                  <TableHead>Precio de Venta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchedProducts.length > 0 ? (
                  searchedProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-slate-800">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold C${
                            product.stock === 0
                              ? "bg-red-100 text-red-700"
                              : product.stock < 10
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {product.stock}{" "}
                          {product.stock === 1 ? "unidad" : "unidades"}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        C${product.salePrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(product)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-gray-500"
                    >
                      No se encontraron productos que coincidan con "
                      {searchTerm}"
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal: Agregar Producto */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Agregar Producto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-800 font-semibold">
                Nombre del Producto
              </Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Ej: Refresco Cola"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-800 font-semibold">Categoría</Label>
              <Select
                value={newProductCategory}
                onValueChange={setNewProductCategory}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddProduct}
              className="w-full bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950"
            >
              Aceptar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Agregar Categoría */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Agregar Categoría
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-800 font-semibold">
                Nombre de la Categoría
              </Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej: Bebidas"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-800 font-semibold">
                Porcentaje de Ganancia
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  step="0.1"
                  value={newCategoryProfit}
                  onChange={(e) => setNewCategoryProfit(e.target.value)}
                  placeholder="3"
                  className="flex-1"
                />
                <span className="text-slate-800 font-semibold text-lg">%</span>
              </div>
            </div>
            <Button
              onClick={handleAddCategory}
              className="w-full bg-gradient-to-r from-blue-800 to-slate-900 hover:from-blue-900 hover:to-slate-950"
            >
              Aceptar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Producto */}
      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Editar Producto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-800 font-semibold">
                Nombre del Producto
              </Label>
              <Input
                value={editingProduct?.name || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
                placeholder="Nombre del producto"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-800 font-semibold">Categoría</Label>
              <Select
                value={editingProduct?.categoryId?.toString() || ""}
                onValueChange={(value) =>
                  setEditingProduct({ ...editingProduct, categoryId: value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSaveEdit}
              className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver Categoría */}
      <Dialog open={isViewCategoryOpen} onOpenChange={setIsViewCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Categoría
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-800 font-semibold">
                Nombre de la Categoría
              </Label>
              <p className="mt-2 text-gray-700">{viewingCategory?.name}</p>
            </div>

            <div>
              <Label className="text-slate-800 font-semibold">
                Porcentaje de Ganancia
              </Label>
              <p className="mt-2 text-gray-700">
                {viewingCategory?.profitPercentage}%
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Categoría */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Editar Categoría
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-800 font-semibold">
                Nombre de la Categoría
              </Label>
              <Input
                value={editingCategory?.name || ""}
                onChange={(e) =>
                  setEditingCategory({
                    ...editingCategory,
                    name: e.target.value,
                  })
                }
                placeholder="Nombre de la categoría"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-800 font-semibold">
                Porcentaje de Ganancia
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  step="0.1"
                  value={editingCategory?.profitPercentage || "3"}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      profitPercentage: e.target.value,
                    })
                  }
                  placeholder="3"
                  className="flex-1"
                />
                <span className="text-slate-800 font-semibold text-lg">%</span>
              </div>
            </div>
            <Button
              onClick={handleSaveEditCategory}
              className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Eliminar Producto */}
      <AlertDialog
        open={deleteAlert.isOpen}
        onOpenChange={(open) =>
          !open && setDeleteAlert({ ...deleteAlert, isOpen: false })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">
              {deleteAlert.hasStock ? "No se puede eliminar" : "¿Está seguro?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {deleteAlert.hasStock
                ? "Este producto no se puede eliminar porque tiene existencia en stock."
                : `¿Está seguro de que desea eliminar el producto "C${deleteAlert.productName}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteAlert.hasStock ? (
              <AlertDialogAction
                onClick={() =>
                  setDeleteAlert({ ...deleteAlert, isOpen: false })
                }
                className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950"
              >
                Entendido
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border-0">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
                >
                  Sí, eliminar
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Eliminar Categoría */}
      <AlertDialog
        open={deleteCategoryAlert.isOpen}
        onOpenChange={(open) =>
          !open &&
          setDeleteCategoryAlert({ ...deleteCategoryAlert, isOpen: false })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">
              {deleteCategoryAlert.hasProducts
                ? "No se puede eliminar"
                : "¿Está seguro?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {deleteCategoryAlert.hasProducts
                ? "Esta categoría no se puede eliminar porque contiene productos."
                : `¿Está seguro de que desea eliminar esta categoría?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteCategoryAlert.hasProducts ? (
              <AlertDialogAction
                onClick={() =>
                  setDeleteCategoryAlert({
                    ...deleteCategoryAlert,
                    isOpen: false,
                  })
                }
                className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950"
              >
                Entendido
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border-0">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDeleteCategory}
                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
                >
                  Sí
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
