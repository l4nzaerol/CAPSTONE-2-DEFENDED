<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\RawMaterial;
use App\Models\Bom;
use App\Models\Material;
use App\Models\Inventory;
use App\Models\InventoryTransaction;

class AccurateMaterialsSeeder extends Seeder
{
    public function run()
    {
        $this->command->info('Creating products with accurate material data...');

        // Create Alkansya product
        $alkansya = Product::updateOrCreate(
            ['product_code' => 'ALK001'],
            [
                'product_name' => 'Alkansya Savings Box',
                'name' => 'Alkansya',
                'description' => 'Traditional Filipino wooden savings box',
                'price' => 0, // Will be calculated from BOM on frontend
                'stock' => 0, // Will be updated by AlkansyaFactorySeeder
                'image' => 'storage/products/Alkansya.jpg',
                'category_name' => 'Stocked Products',
                'raw_materials' => json_encode([
                    'Pinewood 1x4x8ft' => 1/350, // 1 piece produces 350 Alkansya
                    'Plywood 4.2mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Acrylic 1.5mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Pin Nail F30' => 14, // 14 nails per Alkansya
                    'Black Screw 1 1/2' => 4, // 4 screws per Alkansya
                    'Stikwell 250 grams' => 1/200, // 1 piece per 200 Alkansya
                    'Grinder pad 4inch 120 grit' => 1/50, // 1 piece per 50 Alkansya
                    'Sticker 24 inch Car Decals' => 1/78, // 1 piece produces 78 Alkansya
                    'Transfer Tape' => 1/300, // 1 piece per 300 Alkansya
                    'TAPE 2 inch 200m' => 1/150, // 1 piece per 150 Alkansya
                    'Fragile Tape' => 1/500, // 1 piece per 500 Alkansya
                    'Bubble Wrap 40 inch x 100m' => 1/250, // 1 piece per 250 Alkansya
                    'Insulation 8mm 40 inch x 100m' => 1/250 // 1 piece per 250 Alkansya
                ])
            ]
        
        );

        $alkansya = Product::updateOrCreate(
            ['product_code' => 'ALK002'],
            [
                'product_name' => 'Alkansya (Rhinoplasty)',
                'name' => 'Alkansya',
                'description' => 'Traditional Filipino wooden savings box',
                'price' => 0, // Will be calculated from BOM on frontend
                'stock' => 0, // Will be updated by AlkansyaFactorySeeder
                'image' => 'storage/products/Rhino.webp',
                'category_name' => 'Stocked Products',
                'raw_materials' => json_encode([
                    'Pinewood 1x4x8ft' => 1/350, // 1 piece produces 350 Alkansya
                    'Plywood 4.2mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Acrylic 1.5mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Pin Nail F30' => 14, // 14 nails per Alkansya
                    'Black Screw 1 1/2' => 4, // 4 screws per Alkansya
                    'Stikwell 250 grams' => 1/200, // 1 piece per 200 Alkansya
                    'Grinder pad 4inch 120 grit' => 1/50, // 1 piece per 50 Alkansya
                    'Sticker 24 inch Car Decals' => 1/78, // 1 piece produces 78 Alkansya
                    'Transfer Tape' => 1/300, // 1 piece per 300 Alkansya
                    'TAPE 2 inch 200m' => 1/150, // 1 piece per 150 Alkansya
                    'Fragile Tape' => 1/500, // 1 piece per 500 Alkansya
                    'Bubble Wrap 40 inch x 100m' => 1/250, // 1 piece per 250 Alkansya
                    'Insulation 8mm 40 inch x 100m' => 1/250 // 1 piece per 250 Alkansya
                ])
            ]
        );
        $alkansya = Product::updateOrCreate(
            ['product_code' => 'ALK003'],
            [
                'product_name' => 'Alkansya (100k)',
                'name' => 'Alkansya',
                'description' => 'Traditional Filipino wooden savings box',
                'price' => 0, // Will be calculated from BOM on frontend
                'stock' => 0, // Will be updated by AlkansyaFactorySeeder
                'image' => 'storage/products/Alkansya (100k).webp',
                'category_name' => 'Stocked Products',
                'raw_materials' => json_encode([
                    'Pinewood 1x4x8ft' => 1/350, // 1 piece produces 350 Alkansya
                    'Plywood 4.2mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Acrylic 1.5mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Pin Nail F30' => 14, // 14 nails per Alkansya
                    'Black Screw 1 1/2' => 4, // 4 screws per Alkansya
                    'Stikwell 250 grams' => 1/200, // 1 piece per 200 Alkansya
                    'Grinder pad 4inch 120 grit' => 1/50, // 1 piece per 50 Alkansya
                    'Sticker 24 inch Car Decals' => 1/78, // 1 piece produces 78 Alkansya
                    'Transfer Tape' => 1/300, // 1 piece per 300 Alkansya
                    'TAPE 2 inch 200m' => 1/150, // 1 piece per 150 Alkansya
                    'Fragile Tape' => 1/500, // 1 piece per 500 Alkansya
                    'Bubble Wrap 40 inch x 100m' => 1/250, // 1 piece per 250 Alkansya
                    'Insulation 8mm 40 inch x 100m' => 1/250 // 1 piece per 250 Alkansya
                ])
            ]
        );
        $alkansya = Product::updateOrCreate(
            ['product_code' => 'ALK004'],
            [
                'product_name' => 'Alkansya (Forda Iphone)',
                'name' => 'Alkansya',
                'description' => 'Traditional Filipino wooden savings box',
                'price' => 0, // Will be calculated from BOM on frontend
                'stock' => 0, // Will be updated by AlkansyaFactorySeeder
                'image' => 'storage/products/Forda.webp',
                'category_name' => 'Stocked Products',
                'raw_materials' => json_encode([
                    'Pinewood 1x4x8ft' => 1/350, // 1 piece produces 350 Alkansya
                    'Plywood 4.2mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Acrylic 1.5mm 4x8ft' => 1/78, // 1 piece produces 78 Alkansya
                    'Pin Nail F30' => 14, // 14 nails per Alkansya
                    'Black Screw 1 1/2' => 4, // 4 screws per Alkansya
                    'Stikwell 250 grams' => 1/200, // 1 piece per 200 Alkansya
                    'Grinder pad 4inch 120 grit' => 1/50, // 1 piece per 50 Alkansya
                    'Sticker 24 inch Car Decals' => 1/78, // 1 piece produces 78 Alkansya
                    'Transfer Tape' => 1/300, // 1 piece per 300 Alkansya
                    'TAPE 2 inch 200m' => 1/150, // 1 piece per 150 Alkansya
                    'Fragile Tape' => 1/500, // 1 piece per 500 Alkansya
                    'Bubble Wrap 40 inch x 100m' => 1/250, // 1 piece per 250 Alkansya
                    'Insulation 8mm 40 inch x 100m' => 1/250 // 1 piece per 250 Alkansya
                ])
            ]
        );

        // Create Dining Table Set product (includes table, 2 chairs, and 1 bench)
        $diningTableSet = Product::updateOrCreate(
            ['product_code' => 'DTS001'],
            [
                'product_name' => 'Dining Table Set',
                'name' => 'Dining Table Set',
                'description' => 'Complete mahogany dining set: 1 table (4ft x 3ft x 30in), 2 curved chairs, and 1 bench (4ft x 14in x 18in)',
                'price' => rand(45000, 65000), // Price for complete set
                'stock' => 0, // Made to order
                'image' => 'storage/products/DiningTableSet.png',
                'category_name' => 'Made to Order',
                'raw_materials' => json_encode([
                    // Table materials
                    'Mahogany Hardwood 2x4x8ft' => 2, // Table top
                    'Mahogany Hardwood 1x6x8ft' => 1, // Table frame
                    'Steel Tubing 2x2x8ft' => 2, // Metal legs
                    'Steel Tubing 1x1x8ft' => 1, // Cross support
                    'Wood Screws 3 inch' => 16,
                    'Wood Glue 500ml' => 0.5,
                    'Sandpaper 80 Grit' => 2,
                    'Sandpaper 120 Grit' => 3,
                    'Sandpaper 220 Grit' => 2,
                    'Wood Stain Walnut 1 Liter' => 0.4,
                    'Polyurethane Gloss 1 Liter' => 0.5,
                    'Felt Pads Large' => 4,
                    
                    // 2 Curved Chairs materials
                    'Mahogany Hardwood 2x2x6ft' => 2, // Chair frames
                    'Mahogany Hardwood 1x4x6ft' => 1, // Chair backs
                    'Plywood 12mm 2x2ft' => 1, // Chair seats
                    'Foam Cushion 2 inch' => 2, // Seat cushions
                    'Upholstery Fabric' => 2, // Seat covers
                    'Upholstery Staples' => 100,
                    'Wood Screws 2.5 inch' => 32,
                    'Wood Dowels 8mm' => 16,
                    'Wood Glue 250ml' => 1,
                    'Sandpaper 80 Grit' => 2,
                    'Sandpaper 120 Grit' => 3,
                    'Sandpaper 220 Grit' => 2,
                    'Wood Stain Walnut 500ml' => 0.6,
                    'Lacquer Spray Clear' => 2,
                    'Felt Pads Small' => 2,
                    
                    // 1 Bench materials
                    'Mahogany Hardwood 2x4x8ft' => 1, // Bench seat
                    'Mahogany Hardwood 1x4x6ft' => 1, // Bench frame
                    'Steel Tubing 2x2x6ft' => 2, // Bench legs
                    'Wood Screws 3 inch' => 12,
                    'Wood Glue 500ml' => 0.3,
                    'Sandpaper 80 Grit' => 1,
                    'Sandpaper 120 Grit' => 2,
                    'Sandpaper 220 Grit' => 1,
                    'Wood Stain Walnut 1 Liter' => 0.2,
                    'Polyurethane Gloss 1 Liter' => 0.3,
                    'Felt Pads Large' => 2
                ])
            ]
        );

        // Create Wooden Chair product (individual curved chair)
        $woodenChair = Product::updateOrCreate(
            ['product_code' => 'WC001'],
            [
                'product_name' => 'Curved Back High Chair',
                'name' => 'Wooden Chair',
                'description' => 'Comfortable mahogany wooden chair with curved back and upholstered seat',
                'price' => rand(8000, 12000), // Price for individual chair
                'stock' => 0, // Made to order
                'image' => 'storage/products/CurvedBackHighChair.png',
                'category_name' => 'Made to Order',
                'raw_materials' => json_encode([
                    'Mahogany Hardwood 2x2x6ft' => 1, // Chair frame
                    'Mahogany Hardwood 1x4x6ft' => 0.5, // Chair back
                    'Plywood 12mm 2x2ft' => 0.5, // Chair seat
                    'Foam Cushion 2 inch' => 1, // Seat cushion
                    'Upholstery Fabric' => 1, // Seat cover
                    'Upholstery Staples' => 50, // Staples for upholstery
                    'Wood Screws 2.5 inch' => 16, // Assembly screws
                    'Wood Dowels 8mm' => 8, // Joinery dowels
                    'Wood Glue 250ml' => 0.5, // Wood glue
                    'Sandpaper 80 Grit' => 1, // Coarse sanding
                    'Sandpaper 120 Grit' => 1.5, // Medium sanding
                    'Sandpaper 220 Grit' => 1, // Fine sanding
                    'Wood Stain Walnut 500ml' => 0.3, // Wood stain
                    'Lacquer Spray Clear' => 1, // Clear finish
                    'Felt Pads Small' => 1 // Floor protection
                ])
            ]
        );

        // Create materials in the materials table
        $this->createMaterials();

        // Create inventory records and transactions for materials
        $this->createInventoryRecords();

        // Create raw materials entries for each product
        $this->createRawMaterials($alkansya, $diningTableSet, $woodenChair);

        // Create BOM entries for all Alkansya products and made-to-order products
        $this->createBomEntriesForAllAlkansya();
        $this->createBomEntriesForMadeToOrderProducts($diningTableSet, $woodenChair);

        $this->command->info('Accurate materials data seeded successfully!');
    }

    private function createMaterials()
    {
        // All 53 unique materials used across all products
        $materials = [
            // Alkansya materials (13)
            ['material_code' => 'PW-1X4X8', 'material_name' => 'Pinewood 1x4x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 150.00],
            ['material_code' => 'PLY-4.2-4X8', 'material_name' => 'Plywood 4.2mm 4x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 800.00],
            ['material_code' => 'ACR-1.5-4X8', 'material_name' => 'Acrylic 1.5mm 4x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 1200.00],
            ['material_code' => 'PN-F30', 'material_name' => 'Pin Nail F30', 'unit_of_measure' => 'pcs', 'standard_cost' => 0.50],
            ['material_code' => 'BS-1.5', 'material_name' => 'Black Screw 1 1/2', 'unit_of_measure' => 'pcs', 'standard_cost' => 2.00],
            ['material_code' => 'STK-250G', 'material_name' => 'Stikwell 250 grams', 'unit_of_measure' => 'pcs', 'standard_cost' => 150.00],
            ['material_code' => 'GP-4IN-120', 'material_name' => 'Grinder pad 4inch 120 grit', 'unit_of_measure' => 'pcs', 'standard_cost' => 25.00],
            ['material_code' => 'STK-24IN', 'material_name' => 'Sticker 24 inch Car Decals', 'unit_of_measure' => 'pcs', 'standard_cost' => 50.00],
            ['material_code' => 'TT-TAPE', 'material_name' => 'Transfer Tape', 'unit_of_measure' => 'pcs', 'standard_cost' => 200.00],
            ['material_code' => 'TAPE-2IN-200M', 'material_name' => 'TAPE 2 inch 200m', 'unit_of_measure' => 'pcs', 'standard_cost' => 300.00],
            ['material_code' => 'FT-TAPE', 'material_name' => 'Fragile Tape', 'unit_of_measure' => 'pcs', 'standard_cost' => 250.00],
            ['material_code' => 'BW-40IN-100M', 'material_name' => 'Bubble Wrap 40 inch x 100m', 'unit_of_measure' => 'pcs', 'standard_cost' => 500.00],
            ['material_code' => 'INS-8MM-40IN-100M', 'material_name' => 'Insulation 8mm 40 inch x 100m', 'unit_of_measure' => 'pcs', 'standard_cost' => 400.00],

            // Dining Table Set and Wooden Chair materials (40 more unique materials)
            ['material_code' => 'HW-MAHOG-2X4X8', 'material_name' => 'Mahogany Hardwood 2x4x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 1200.00],
            ['material_code' => 'HW-MAHOG-1X6X8', 'material_name' => 'Mahogany Hardwood 1x6x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 1200.00],
            ['material_code' => 'HW-MAHOG-1X4X6', 'material_name' => 'Mahogany Hardwood 1x4x6ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 900.00],
            ['material_code' => 'HW-MAHOG-2X2X6', 'material_name' => 'Mahogany Hardwood 2x2x6ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 800.00],
            ['material_code' => 'ST-TUBE-2X2X8', 'material_name' => 'Steel Tubing 2x2x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 800.00],
            ['material_code' => 'ST-TUBE-1X1X8', 'material_name' => 'Steel Tubing 1x1x8ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 400.00],
            ['material_code' => 'ST-TUBE-2X2X6', 'material_name' => 'Steel Tubing 2x2x6ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 600.00],
            ['material_code' => 'WS-3', 'material_name' => 'Wood Screws 3 inch', 'unit_of_measure' => 'pcs', 'standard_cost' => 5.00],
            ['material_code' => 'WS-2.5', 'material_name' => 'Wood Screws 2.5 inch', 'unit_of_measure' => 'pcs', 'standard_cost' => 4.00],
            ['material_code' => 'WD-8MM', 'material_name' => 'Wood Dowels 8mm', 'unit_of_measure' => 'pcs', 'standard_cost' => 2.00],
            ['material_code' => 'WG-500', 'material_name' => 'Wood Glue 500ml', 'unit_of_measure' => 'pcs', 'standard_cost' => 200.00],
            ['material_code' => 'WG-250', 'material_name' => 'Wood Glue 250ml', 'unit_of_measure' => 'pcs', 'standard_cost' => 100.00],
            ['material_code' => 'PLY-12-2X4', 'material_name' => 'Plywood 12mm 2x4ft', 'unit_of_measure' => 'pcs', 'standard_cost' => 500.00],
            ['material_code' => 'SAND-80', 'material_name' => 'Sandpaper 80 Grit', 'unit_of_measure' => 'pcs', 'standard_cost' => 15.00],
            ['material_code' => 'SAND-120', 'material_name' => 'Sandpaper 120 Grit', 'unit_of_measure' => 'pcs', 'standard_cost' => 15.00],
            ['material_code' => 'SAND-220', 'material_name' => 'Sandpaper 220 Grit', 'unit_of_measure' => 'pcs', 'standard_cost' => 15.00],
            ['material_code' => 'STAIN-WALNUT-1L', 'material_name' => 'Wood Stain Walnut 1 Liter', 'unit_of_measure' => 'pcs', 'standard_cost' => 800.00],
            ['material_code' => 'STAIN-WALNUT-500', 'material_name' => 'Wood Stain Walnut 500ml', 'unit_of_measure' => 'pcs', 'standard_cost' => 400.00],
            ['material_code' => 'POLY-GLOSS-1L', 'material_name' => 'Polyurethane Gloss 1 Liter', 'unit_of_measure' => 'pcs', 'standard_cost' => 1000.00],
            ['material_code' => 'FELT-PAD-LG', 'material_name' => 'Felt Pads Large', 'unit_of_measure' => 'pcs', 'standard_cost' => 50.00],
            ['material_code' => 'FELT-PAD-SM', 'material_name' => 'Felt Pads Small', 'unit_of_measure' => 'pcs', 'standard_cost' => 25.00],
            ['material_code' => 'FOAM-CUSHION-2', 'material_name' => 'Foam Cushion 2 inch', 'unit_of_measure' => 'pcs', 'standard_cost' => 300.00],
            ['material_code' => 'FABRIC-UPHOLSTERY', 'material_name' => 'Upholstery Fabric', 'unit_of_measure' => 'pcs', 'standard_cost' => 400.00],
            ['material_code' => 'STAPLES-UPHOLSTERY', 'material_name' => 'Upholstery Staples', 'unit_of_measure' => 'pcs', 'standard_cost' => 0.10],
            ['material_code' => 'LACQUER-SPRAY', 'material_name' => 'Lacquer Spray Clear', 'unit_of_measure' => 'pcs', 'standard_cost' => 200.00],
        ];

        foreach ($materials as $material) {
            // Determine supplier and lead time based on material type
            $supplier = $this->getSupplierForMaterial($material['material_code']);
            $leadTimeDays = $this->getLeadTimeForMaterial($material['material_code']);
            $criticalStock = $this->getCriticalStockForMaterial($material['material_code']);
            $maxLevel = $this->getMaxLevelForMaterial($material['material_code']);

            // Calculate reorder_level to be greater than critical_stock
            // Reorder level should be at least 1.5x critical stock to ensure proper hierarchy
            $reorderLevel = max(15, ceil($criticalStock * 1.5));
            
            Material::updateOrCreate(
                ['material_code' => $material['material_code']],
                [
                    'material_name' => $material['material_name'],
                    'description' => 'Material for furniture production',
                    'unit_of_measure' => $material['unit_of_measure'],
                    'reorder_level' => $reorderLevel,
                    'standard_cost' => $material['standard_cost'],
                    'current_stock' => 1000,
                    'location' => 'Windfield 2',
                    'critical_stock' => $criticalStock,
                    'max_level' => 800, // Set max_level to 800 for all materials
                    'lead_time_days' => $leadTimeDays,
                    'supplier' => $supplier,
                    'category' => 'raw'
                ]
            );
        }
    }

    private function createInventoryRecords()
    {
        $this->command->info('Creating inventory records and transactions...');
        
        $materials = Material::all();
        foreach ($materials as $material) {
            // Create inventory record
            $inventory = Inventory::firstOrCreate(
                ['material_id' => $material->material_id],
                [
                    'material_id' => $material->material_id,
                    'location_id' => 1,
                    'current_stock' => $material->current_stock,
                    'quantity_reserved' => 0,
                    'last_updated' => now()
                ]
            );

            // Create initial stock transaction
            InventoryTransaction::firstOrCreate(
                [
                    'material_id' => $material->material_id,
                    'transaction_type' => 'PURCHASE',
                    'reference' => 'Initial Stock - Accurate Materials'
                ],
                [
                    'material_id' => $material->material_id,
                    'transaction_type' => 'PURCHASE',
                    'quantity' => $material->current_stock,
                    'reference' => 'Initial Stock - Accurate Materials',
                    'remarks' => 'Initial material stock from AccurateMaterialsSeeder',
                    'timestamp' => now(),
                    'unit_cost' => $material->standard_cost,
                    'total_cost' => $material->standard_cost * $material->current_stock
                ]
            );
        }
        
        $this->command->info('Inventory records and transactions created successfully!');
    }

    private function getSupplierForMaterial($materialCode)
    {
        // Determine supplier based on material type
        if (strpos($materialCode, 'PW-') === 0 || strpos($materialCode, 'PLY-') === 0 || strpos($materialCode, 'HW-') === 0) {
            return 'Timber Supply Co.';
        } elseif (strpos($materialCode, 'ST-TUBE-') === 0) {
            return 'Metal Works Supply Co.';
        } elseif (strpos($materialCode, 'ACR-') === 0 || strpos($materialCode, 'FOAM-') === 0 || strpos($materialCode, 'FABRIC-') === 0) {
            return 'Plastic & Fabric Supply Inc.';
        } elseif (strpos($materialCode, 'PN-') === 0 || strpos($materialCode, 'BS-') === 0 || strpos($materialCode, 'WS-') === 0 || strpos($materialCode, 'WD-') === 0) {
            return 'Hardware Supply Co.';
        } elseif (strpos($materialCode, 'STK-') === 0 || strpos($materialCode, 'TAPE-') === 0 || strpos($materialCode, 'BW-') === 0 || strpos($materialCode, 'INS-') === 0) {
            return 'Packaging Materials Ltd.';
        } elseif (strpos($materialCode, 'STAIN-') === 0 || strpos($materialCode, 'POLY-') === 0 || strpos($materialCode, 'LACQUER-') === 0 || strpos($materialCode, 'WG-') === 0) {
            return 'Chemical & Adhesives Corp.';
        } elseif (strpos($materialCode, 'SAND-') === 0 || strpos($materialCode, 'GP-') === 0) {
            return 'Abrasive Tools Supply';
        } else {
            return 'General Materials Corp.';
        }
    }

    private function getLeadTimeForMaterial($materialCode)
    {
        // Determine lead time based on material type
        if (strpos($materialCode, 'PW-') === 0 || strpos($materialCode, 'PLY-') === 0 || strpos($materialCode, 'HW-') === 0) {
            return 14; // Wood materials - longer lead time
        } elseif (strpos($materialCode, 'ST-TUBE-') === 0) {
            return 10; // Steel tubing - moderate lead time
        } elseif (strpos($materialCode, 'ACR-') === 0 || strpos($materialCode, 'FOAM-') === 0 || strpos($materialCode, 'FABRIC-') === 0) {
            return 21; // Specialized materials - longer lead time
        } elseif (strpos($materialCode, 'PN-') === 0 || strpos($materialCode, 'BS-') === 0 || strpos($materialCode, 'WS-') === 0 || strpos($materialCode, 'WD-') === 0) {
            return 7; // Hardware - shorter lead time
        } elseif (strpos($materialCode, 'STK-') === 0 || strpos($materialCode, 'TAPE-') === 0 || strpos($materialCode, 'BW-') === 0 || strpos($materialCode, 'INS-') === 0) {
            return 10; // Packaging materials
        } elseif (strpos($materialCode, 'STAIN-') === 0 || strpos($materialCode, 'POLY-') === 0 || strpos($materialCode, 'LACQUER-') === 0 || strpos($materialCode, 'WG-') === 0) {
            return 14; // Chemicals - moderate lead time
        } elseif (strpos($materialCode, 'SAND-') === 0 || strpos($materialCode, 'GP-') === 0) {
            return 5; // Abrasives - short lead time
        } else {
            return 7; // Default lead time
        }
    }

    private function getCriticalStockForMaterial($materialCode)
    {
        // Determine critical stock based on material type and usage
        if (strpos($materialCode, 'PW-') === 0 || strpos($materialCode, 'PLY-') === 0 || strpos($materialCode, 'HW-') === 0) {
            return 50; // Wood materials - higher critical stock
        } elseif (strpos($materialCode, 'ST-TUBE-') === 0) {
            return 30; // Steel tubing - moderate critical stock
        } elseif (strpos($materialCode, 'ACR-') === 0 || strpos($materialCode, 'FOAM-') === 0 || strpos($materialCode, 'FABRIC-') === 0) {
            return 20; // Specialized materials - moderate critical stock
        } elseif (strpos($materialCode, 'PN-') === 0 || strpos($materialCode, 'BS-') === 0 || strpos($materialCode, 'WS-') === 0 || strpos($materialCode, 'WD-') === 0) {
            return 100; // Hardware - high critical stock (small items)
        } elseif (strpos($materialCode, 'STK-') === 0 || strpos($materialCode, 'TAPE-') === 0 || strpos($materialCode, 'BW-') === 0 || strpos($materialCode, 'INS-') === 0) {
            return 30; // Packaging materials
        } elseif (strpos($materialCode, 'STAIN-') === 0 || strpos($materialCode, 'POLY-') === 0 || strpos($materialCode, 'LACQUER-') === 0 || strpos($materialCode, 'WG-') === 0) {
            return 15; // Chemicals - lower critical stock
        } elseif (strpos($materialCode, 'SAND-') === 0 || strpos($materialCode, 'GP-') === 0) {
            return 25; // Abrasives
        } else {
            return 20; // Default critical stock
        }
    }

    private function getMaxLevelForMaterial($materialCode)
    {
        // All materials now have max_level set to 800 as per requirements
        // This method is kept for consistency but always returns 800
        return 800;
    }

    private function createRawMaterials($alkansya, $diningTableSet, $woodenChair)
    {
        // Clear ALL existing raw materials to avoid conflicts
        RawMaterial::truncate();
        
        // Alkansya raw materials - quantities per Alkansya based on production capacity
        $alkansyaMaterials = [
            ['material_name' => 'Pinewood 1x4x8ft', 'material_code' => 'PW-1X4X8', 'quantity_needed' => 1/350, 'unit_of_measure' => 'pcs', 'unit_cost' => 150.00], // 1 piece produces 350 Alkansya
            ['material_name' => 'Plywood 4.2mm 4x8ft', 'material_code' => 'PLY-4.2-4X8', 'quantity_needed' => 1/78, 'unit_of_measure' => 'pcs', 'unit_cost' => 800.00], // 1 piece produces 78 Alkansya
            ['material_name' => 'Acrylic 1.5mm 4x8ft', 'material_code' => 'ACR-1.5-4X8', 'quantity_needed' => 1/78, 'unit_of_measure' => 'pcs', 'unit_cost' => 1200.00], // 1 piece produces 78 Alkansya
            ['material_name' => 'Pin Nail F30', 'material_code' => 'PN-F30', 'quantity_needed' => 14, 'unit_of_measure' => 'pcs', 'unit_cost' => 0.50], // 14 nails per Alkansya
            ['material_name' => 'Black Screw 1 1/2', 'material_code' => 'BS-1.5', 'quantity_needed' => 4, 'unit_of_measure' => 'pcs', 'unit_cost' => 2.00], // 4 screws per Alkansya
            ['material_name' => 'Stikwell 250 grams', 'material_code' => 'STK-250G', 'quantity_needed' => 1/200, 'unit_of_measure' => 'pcs', 'unit_cost' => 150.00], // 1 piece per 200 Alkansya
            ['material_name' => 'Grinder pad 4inch 120 grit', 'material_code' => 'GP-4IN-120', 'quantity_needed' => 1/50, 'unit_of_measure' => 'pcs', 'unit_cost' => 25.00], // 1 piece per 50 Alkansya
            ['material_name' => 'Sticker 24 inch Car Decals', 'material_code' => 'STK-24IN', 'quantity_needed' => 1/78, 'unit_of_measure' => 'pcs', 'unit_cost' => 50.00], // 1 piece produces 78 Alkansya
            ['material_name' => 'Transfer Tape', 'material_code' => 'TT-TAPE', 'quantity_needed' => 1/300, 'unit_of_measure' => 'pcs', 'unit_cost' => 200.00], // 1 piece per 300 Alkansya
            ['material_name' => 'TAPE 2 inch 200m', 'material_code' => 'TAPE-2IN-200M', 'quantity_needed' => 1/150, 'unit_of_measure' => 'pcs', 'unit_cost' => 300.00], // 1 piece per 150 Alkansya
            ['material_name' => 'Fragile Tape', 'material_code' => 'FT-TAPE', 'quantity_needed' => 1/500, 'unit_of_measure' => 'pcs', 'unit_cost' => 250.00], // 1 piece per 500 Alkansya
            ['material_name' => 'Bubble Wrap 40 inch x 100m', 'material_code' => 'BW-40IN-100M', 'quantity_needed' => 1/250, 'unit_of_measure' => 'pcs', 'unit_cost' => 500.00], // 1 piece per 250 Alkansya
            ['material_name' => 'Insulation 8mm 40 inch x 100m', 'material_code' => 'INS-8MM-40IN-100M', 'quantity_needed' => 1/250, 'unit_of_measure' => 'pcs', 'unit_cost' => 400.00], // 1 piece per 250 Alkansya
        ];

        foreach ($alkansyaMaterials as $material) {
            RawMaterial::updateOrCreate(
                [
                    'product_id' => $alkansya->id,
                    'material_name' => $material['material_name']
                ],
                [
                    'material_code' => $material['material_code'],
                    'quantity_needed' => $material['quantity_needed'],
                    'unit_of_measure' => $material['unit_of_measure'],
                    'unit_cost' => $material['unit_cost'],
                    'total_cost' => $material['quantity_needed'] * $material['unit_cost'],
                    'description' => 'Raw material for Alkansya production'
                ]
            );
        }

        // Dining Table Set raw materials (table + 2 chairs + 1 bench) - combined to avoid duplicates
        $diningTableSetMaterials = [
            // Table + Bench materials (combined)
            ['material_name' => 'Mahogany Hardwood 2x4x8ft', 'material_code' => 'HW-MAHOG-2X4X8', 'quantity_needed' => 3, 'unit_of_measure' => 'pcs', 'unit_cost' => 1200.00], // 2 (table) + 1 (bench)
            ['material_name' => 'Mahogany Hardwood 1x6x8ft', 'material_code' => 'HW-MAHOG-1X6X8', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 1200.00],
            ['material_name' => 'Mahogany Hardwood 1x4x6ft', 'material_code' => 'HW-MAHOG-1X4X6', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 900.00], // 1 (chairs) + 1 (bench)
            ['material_name' => 'Steel Tubing 2x2x8ft', 'material_code' => 'ST-TUBE-2X2X8', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 800.00],
            ['material_name' => 'Steel Tubing 1x1x8ft', 'material_code' => 'ST-TUBE-1X1X8', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 400.00],
            ['material_name' => 'Steel Tubing 2x2x6ft', 'material_code' => 'ST-TUBE-2X2X6', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 600.00],
            ['material_name' => 'Wood Screws 3 inch', 'material_code' => 'WS-3', 'quantity_needed' => 28, 'unit_of_measure' => 'pcs', 'unit_cost' => 5.00], // 16 (table) + 12 (bench)
            ['material_name' => 'Wood Screws 2.5 inch', 'material_code' => 'WS-2.5', 'quantity_needed' => 32, 'unit_of_measure' => 'pcs', 'unit_cost' => 4.00],
            ['material_name' => 'Wood Dowels 8mm', 'material_code' => 'WD-8MM', 'quantity_needed' => 16, 'unit_of_measure' => 'pcs', 'unit_cost' => 2.00],
            ['material_name' => 'Wood Glue 500ml', 'material_code' => 'WG-500', 'quantity_needed' => 1.3, 'unit_of_measure' => 'pcs', 'unit_cost' => 200.00], // 0.5 (table) + 0.3 (bench) + 0.5 (overflow)
            ['material_name' => 'Wood Glue 250ml', 'material_code' => 'WG-250', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 100.00],
            ['material_name' => 'Plywood 12mm 2x2ft', 'material_code' => 'PLY-12-2X4', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 500.00],
            ['material_name' => 'Foam Cushion 2 inch', 'material_code' => 'FOAM-CUSHION-2', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 300.00],
            ['material_name' => 'Upholstery Fabric', 'material_code' => 'FABRIC-UPHOLSTERY', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 400.00],
            ['material_name' => 'Upholstery Staples', 'material_code' => 'STAPLES-UPHOLSTERY', 'quantity_needed' => 100, 'unit_of_measure' => 'pcs', 'unit_cost' => 0.10],
            ['material_name' => 'Sandpaper 80 Grit', 'material_code' => 'SAND-80', 'quantity_needed' => 5, 'unit_of_measure' => 'pcs', 'unit_cost' => 15.00], // 2 (table) + 2 (chairs) + 1 (bench)
            ['material_name' => 'Sandpaper 120 Grit', 'material_code' => 'SAND-120', 'quantity_needed' => 8, 'unit_of_measure' => 'pcs', 'unit_cost' => 15.00], // 3 (table) + 3 (chairs) + 2 (bench)
            ['material_name' => 'Sandpaper 220 Grit', 'material_code' => 'SAND-220', 'quantity_needed' => 5, 'unit_of_measure' => 'pcs', 'unit_cost' => 15.00], // 2 (table) + 2 (chairs) + 1 (bench)
            ['material_name' => 'Wood Stain Walnut 1 Liter', 'material_code' => 'STAIN-WALNUT-1L', 'quantity_needed' => 0.6, 'unit_of_measure' => 'pcs', 'unit_cost' => 800.00], // 0.4 (table) + 0.2 (bench)
            ['material_name' => 'Wood Stain Walnut 500ml', 'material_code' => 'STAIN-WALNUT-500', 'quantity_needed' => 0.6, 'unit_of_measure' => 'pcs', 'unit_cost' => 400.00],
            ['material_name' => 'Polyurethane Gloss 1 Liter', 'material_code' => 'POLY-GLOSS-1L', 'quantity_needed' => 0.8, 'unit_of_measure' => 'pcs', 'unit_cost' => 1000.00], // 0.5 (table) + 0.3 (bench)
            ['material_name' => 'Lacquer Spray Clear', 'material_code' => 'LACQUER-SPRAY', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 200.00],
            ['material_name' => 'Felt Pads Large', 'material_code' => 'FELT-PAD-LG', 'quantity_needed' => 6, 'unit_of_measure' => 'pcs', 'unit_cost' => 50.00], // 4 (table) + 2 (bench)
            ['material_name' => 'Felt Pads Small', 'material_code' => 'FELT-PAD-SM', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 25.00],
            ['material_name' => 'Mahogany Hardwood 2x2x6ft', 'material_code' => 'HW-MAHOG-2X2X6', 'quantity_needed' => 2, 'unit_of_measure' => 'pcs', 'unit_cost' => 800.00],
        ];

        // Get materials for reference
        $materials = Material::all()->keyBy('material_code');
        
        foreach ($diningTableSetMaterials as $material) {
            if (isset($materials[$material['material_code']])) {
                $rawMaterial = new RawMaterial();
                $rawMaterial->product_id = $diningTableSet->id;
                $rawMaterial->material_name = $material['material_name'];
                // Append product ID to make material_code unique per product
                $rawMaterial->material_code = $material['material_code'] . '-P' . $diningTableSet->id;
                $rawMaterial->quantity_needed = $material['quantity_needed'];
                $rawMaterial->unit_of_measure = $material['unit_of_measure'];
                $rawMaterial->unit_cost = $material['unit_cost'];
                $rawMaterial->total_cost = $material['quantity_needed'] * $material['unit_cost'];
                $rawMaterial->description = 'Raw material for Dining Table Set production';
                $rawMaterial->save();
            }
        }

        // Wooden Chair raw materials (individual curved chair)
        $woodenChairMaterials = [
            ['material_name' => 'Mahogany Hardwood 2x2x6ft', 'material_code' => 'HW-MAHOG-2X2X6', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 800.00],
            ['material_name' => 'Mahogany Hardwood 1x4x6ft', 'material_code' => 'HW-MAHOG-1X4X6', 'quantity_needed' => 0.5, 'unit_of_measure' => 'pcs', 'unit_cost' => 900.00],
            ['material_name' => 'Plywood 12mm 2x2ft', 'material_code' => 'PLY-12-2X4', 'quantity_needed' => 0.5, 'unit_of_measure' => 'pcs', 'unit_cost' => 500.00],
            ['material_name' => 'Wood Screws 2.5 inch', 'material_code' => 'WS-2.5', 'quantity_needed' => 16, 'unit_of_measure' => 'pcs', 'unit_cost' => 4.00],
            ['material_name' => 'Wood Dowels 8mm', 'material_code' => 'WD-8MM', 'quantity_needed' => 8, 'unit_of_measure' => 'pcs', 'unit_cost' => 2.00],
            ['material_name' => 'Wood Glue 250ml', 'material_code' => 'WG-250', 'quantity_needed' => 0.5, 'unit_of_measure' => 'pcs', 'unit_cost' => 100.00],
            ['material_name' => 'Foam Cushion 2 inch', 'material_code' => 'FOAM-CUSHION-2', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 300.00],
            ['material_name' => 'Upholstery Fabric', 'material_code' => 'FABRIC-UPHOLSTERY', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 400.00],
            ['material_name' => 'Upholstery Staples', 'material_code' => 'STAPLES-UPHOLSTERY', 'quantity_needed' => 50, 'unit_of_measure' => 'pcs', 'unit_cost' => 0.10],
            ['material_name' => 'Sandpaper 80 Grit', 'material_code' => 'SAND-80', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 15.00],
            ['material_name' => 'Sandpaper 120 Grit', 'material_code' => 'SAND-120', 'quantity_needed' => 1.5, 'unit_of_measure' => 'pcs', 'unit_cost' => 15.00],
            ['material_name' => 'Sandpaper 220 Grit', 'material_code' => 'SAND-220', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 15.00],
            ['material_name' => 'Wood Stain Walnut 500ml', 'material_code' => 'STAIN-WALNUT-500', 'quantity_needed' => 0.3, 'unit_of_measure' => 'pcs', 'unit_cost' => 400.00],
            ['material_name' => 'Lacquer Spray Clear', 'material_code' => 'LACQUER-SPRAY', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 200.00],
            ['material_name' => 'Felt Pads Small', 'material_code' => 'FELT-PAD-SM', 'quantity_needed' => 1, 'unit_of_measure' => 'pcs', 'unit_cost' => 25.00],
        ];

        foreach ($woodenChairMaterials as $material) {
            if (isset($materials[$material['material_code']])) {
                $rawMaterial = new RawMaterial();
                $rawMaterial->product_id = $woodenChair->id;
                $rawMaterial->material_name = $material['material_name'];
                // Append product ID to make material_code unique per product
                $rawMaterial->material_code = $material['material_code'] . '-P' . $woodenChair->id;
                $rawMaterial->quantity_needed = $material['quantity_needed'];
                $rawMaterial->unit_of_measure = $material['unit_of_measure'];
                $rawMaterial->unit_cost = $material['unit_cost'];
                $rawMaterial->total_cost = $material['quantity_needed'] * $material['unit_cost'];
                $rawMaterial->description = 'Raw material for Wooden Chair production';
                $rawMaterial->save();
            }
        }
    }

    private function createBomEntriesForAllAlkansya()
    {
        // Get materials for BOM entries
        $materials = Material::all()->keyBy('material_code');

        // Get all Alkansya products
        $alkansyaProducts = Product::where('category_name', 'Stocked Products')
            ->where('name', 'Alkansya')
            ->get();

        $this->command->info('Found ' . $alkansyaProducts->count() . ' Alkansya products to create BOM entries for');

        // Alkansya BOM entries - calculated based on how many Alkansya can be produced from each piece
        $alkansyaBomMaterials = [
            'PW-1X4X8' => 1/350, // 1 piece produces 350 Alkansya, so per Alkansya = 1/350
            'PLY-4.2-4X8' => 1/78, // 1 piece produces 78 Alkansya, so per Alkansya = 1/78
            'ACR-1.5-4X8' => 1/78, // 1 piece produces 78 Alkansya, so per Alkansya = 1/78
            'PN-F30' => 14, // 14 nails per Alkansya
            'BS-1.5' => 4, // 4 screws per Alkansya
            'STK-250G' => 1/200, // 1 piece per 200 Alkansya, so per Alkansya = 1/200
            'GP-4IN-120' => 1/50, // 1 piece per 50 Alkansya, so per Alkansya = 1/50
            'STK-24IN' => 1/78, // 1 piece produces 78 Alkansya, so per Alkansya = 1/78
            'TT-TAPE' => 1/300, // 1 piece per 300 Alkansya, so per Alkansya = 1/300
            'TAPE-2IN-200M' => 1/150, // 1 piece per 150 Alkansya, so per Alkansya = 1/150
            'FT-TAPE' => 1/500, // 1 piece per 500 Alkansya, so per Alkansya = 1/500
            'BW-40IN-100M' => 1/250, // 1 piece per 250 Alkansya, so per Alkansya = 1/250
            'INS-8MM-40IN-100M' => 1/250, // 1 piece per 250 Alkansya, so per Alkansya = 1/250
        ];

        // Create BOM entries for each Alkansya product
        foreach ($alkansyaProducts as $alkansyaProduct) {
            $this->command->info("Creating BOM entries for {$alkansyaProduct->product_name} (ID: {$alkansyaProduct->id})");
            
            foreach ($alkansyaBomMaterials as $materialCode => $quantity) {
                if (isset($materials[$materialCode])) {
                    Bom::updateOrCreate(
                        [
                            'product_id' => $alkansyaProduct->id,
                            'material_id' => $materials[$materialCode]->material_id
                        ],
                        [
                            'material_name' => $materials[$materialCode]->material_name,
                            'quantity_per_product' => $quantity,
                            'unit_of_measure' => $materials[$materialCode]->unit_of_measure
                        ]
                    );
                }
            }
        }

        $this->command->info('BOM entries created for all Alkansya products!');
    }

    private function createBomEntriesForMadeToOrderProducts($diningTableSet, $woodenChair)
    {
        // Get materials for BOM entries
        $materials = Material::all()->keyBy('material_code');

        $this->command->info('Creating BOM entries for made-to-order products...');

        // Dining Table Set BOM entries
        $diningTableSetBomMaterials = [
            // Table materials
            'HW-MAHOG-2X4X8' => 2,
            'HW-MAHOG-1X6X8' => 1,
            'ST-TUBE-2X2X8' => 2,
            'ST-TUBE-1X1X8' => 1,
            'WS-3' => 16,
            'WG-500' => 0.5,
            'SAND-80' => 2,
            'SAND-120' => 3,
            'SAND-220' => 2,
            'STAIN-WALNUT-1L' => 0.4,
            'POLY-GLOSS-1L' => 0.5,
            'FELT-PAD-LG' => 4,
            
            // 2 Curved Chairs materials
            'HW-MAHOG-2X2X6' => 2,
            'HW-MAHOG-1X4X6' => 1,
            'PLY-12-2X4' => 1,
            'FOAM-CUSHION-2' => 2,
            'FABRIC-UPHOLSTERY' => 2,
            'STAPLES-UPHOLSTERY' => 100,
            'WS-2.5' => 32,
            'WD-8MM' => 16,
            'WG-250' => 1,
            'STAIN-WALNUT-500' => 0.6,
            'LACQUER-SPRAY' => 2,
            'FELT-PAD-SM' => 2,
            
            // 1 Bench materials
            'ST-TUBE-2X2X6' => 2,
            'WS-3' => 12,
            'WG-500' => 0.3,
            'STAIN-WALNUT-1L' => 0.2,
            'POLY-GLOSS-1L' => 0.3,
        ];

        // Create BOM entries for Dining Table Set
        $this->command->info("Creating BOM entries for {$diningTableSet->product_name} (ID: {$diningTableSet->id})");
        foreach ($diningTableSetBomMaterials as $materialCode => $quantity) {
            if (isset($materials[$materialCode])) {
                Bom::updateOrCreate(
                    [
                        'product_id' => $diningTableSet->id,
                        'material_id' => $materials[$materialCode]->material_id
                    ],
                    [
                        'material_name' => $materials[$materialCode]->material_name,
                        'quantity_per_product' => $quantity,
                        'unit_of_measure' => $materials[$materialCode]->unit_of_measure
                    ]
                );
            }
        }

        // Wooden Chair BOM entries
        $woodenChairBomMaterials = [
            'HW-MAHOG-2X2X6' => 1,
            'HW-MAHOG-1X4X6' => 0.5,
            'PLY-12-2X4' => 0.5,
            'FOAM-CUSHION-2' => 1,
            'FABRIC-UPHOLSTERY' => 1,
            'STAPLES-UPHOLSTERY' => 50,
            'WS-2.5' => 16,
            'WD-8MM' => 8,
            'WG-250' => 0.5,
            'SAND-80' => 1,
            'SAND-120' => 1.5,
            'SAND-220' => 1,
            'STAIN-WALNUT-500' => 0.3,
            'LACQUER-SPRAY' => 1,
            'FELT-PAD-SM' => 1,
        ];

        // Create BOM entries for Wooden Chair
        $this->command->info("Creating BOM entries for {$woodenChair->product_name} (ID: {$woodenChair->id})");
        foreach ($woodenChairBomMaterials as $materialCode => $quantity) {
            if (isset($materials[$materialCode])) {
                Bom::updateOrCreate(
                    [
                        'product_id' => $woodenChair->id,
                        'material_id' => $materials[$materialCode]->material_id
                    ],
                    [
                        'material_name' => $materials[$materialCode]->material_name,
                        'quantity_per_product' => $quantity,
                        'unit_of_measure' => $materials[$materialCode]->unit_of_measure
                    ]
                );
            }
        }

        $this->command->info('BOM entries created for made-to-order products!');
    }

}