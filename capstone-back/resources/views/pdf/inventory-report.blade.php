<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Inventory Report - UNICK Furniture</title>
    <style>
        @page {
            margin: 20mm;
        }
        body {
            font-family: Arial, 'DejaVu Sans', sans-serif;
            font-size: 10pt;
            color: #000;
            margin: 0;
            padding: 0;
            overflow: visible;
        }
        .header {
            display: table;
            width: 100%;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
            table-layout: auto;
        }
        .logo-container {
            display: table-cell;
            vertical-align: middle;
            width: 100px;
            padding-right: 20px;
            padding-top: 0;
            padding-bottom: 0;
        }
        .logo-wrapper {
            width: 100px;
            height: 100px;
            position: relative;
            margin: 0;
            padding: 0;
            overflow: visible;
        }
        .logo-circle {
            width: 100px;
            height: 100px;
            min-width: 100px;
            min-height: 100px;
            max-width: 100px;
            max-height: 100px;
            border-radius: 50%;
            background-color: #000;
            border: 6px solid #fff;
            box-sizing: border-box;
            display: table;
            position: relative;
            margin: 0;
            padding: 0;
            overflow: visible;
            aspect-ratio: 1 / 1;
        }
        .logo-text {
            display: table-cell;
            vertical-align: middle;
            text-align: center;
            color: #fff;
            font-weight: bold;
            font-size: 18pt;
            letter-spacing: 0.8px;
            line-height: 1.1;
            padding: 0;
            margin: 0;
            width: 100%;
            height: 100%;
        }
        .header-text {
            display: table-cell;
            vertical-align: middle;
            padding-left: 0;
        }
        .header-title {
            font-size: 20pt;
            font-weight: bold;
            margin: 0;
            padding: 0;
            color: #000;
            text-transform: uppercase;
        }
        .header-subtitle {
            font-size: 12pt;
            margin: 5px 0 0 0;
            color: #000;
        }
        .report-info {
            margin-bottom: 20px;
            font-size: 9pt;
        }
        .report-info table {
            width: 100%;
            border-collapse: collapse;
        }
        .report-info td {
            padding: 3px 0;
        }
        .report-info td:first-child {
            font-weight: bold;
            width: 120px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            table-layout: fixed;
            word-wrap: break-word;
            page-break-inside: auto;
        }
        th {
            background-color: #2c3e50;
            color: #ffffff;
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: center;
            font-weight: bold;
            font-size: 7pt;
            word-wrap: break-word;
            overflow: hidden;
            vertical-align: middle;
            line-height: 1.2;
        }
        td {
            border: 1px solid #ddd;
            padding: 5px 4px;
            font-size: 7.5pt;
            word-wrap: break-word;
            overflow: hidden;
            vertical-align: middle;
            line-height: 1.3;
        }
        tr:nth-child(even) {
            background-color: #fafafa;
        }
        tr:nth-child(odd) {
            background-color: #ffffff;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        
        /* Simple styling for usage report status columns */
        table.usage-report .status-current,
        table.usage-report .status-projected {
            background-color: #fafafa !important;
            border-left: 1px solid #ddd !important;
        }
        table.usage-report .status-out-of-stock,
        table.usage-report .status-critical,
        table.usage-report .status-low-stock,
        table.usage-report .status-overstocked,
        table.usage-report .status-in-stock {
            background-color: #fafafa !important;
            color: #333 !important;
        }
        
        /* Usage Report (11 columns) - Total: 100% */
        table.usage-report th:nth-child(1), table.usage-report td:nth-child(1) { width: 16%; text-align: left; font-weight: 600; } /* Material Name */
        table.usage-report th:nth-child(2), table.usage-report td:nth-child(2) { width: 9%; text-align: center; } /* Category */
        table.usage-report th:nth-child(3), table.usage-report td:nth-child(3) { width: 8%; text-align: right; } /* Average Daily Consumption */
        table.usage-report th:nth-child(4), table.usage-report td:nth-child(4) { width: 8%; text-align: right; font-weight: 600; } /* Current Stock */
        table.usage-report th:nth-child(5), table.usage-report td:nth-child(5) { width: 6%; text-align: center; } /* Days Until Stockout */
        table.usage-report th:nth-child(6), table.usage-report td:nth-child(6) { width: 8%; text-align: right; } /* Projected Usage (30 days) */
        table.usage-report th:nth-child(7), table.usage-report td:nth-child(7) { width: 8%; text-align: right; font-weight: 600; } /* Projected Stock (30 days) */
        table.usage-report th:nth-child(8), table.usage-report td:nth-child(8) { width: 9%; text-align: center; font-weight: 600; } /* Current Status */
        table.usage-report th:nth-child(9), table.usage-report td:nth-child(9) { width: 10%; text-align: center; font-weight: 600; } /* Projected Status (30 days) */
        table.usage-report th:nth-child(10), table.usage-report td:nth-child(10) { width: 8%; text-align: right; } /* Total Consumption */
        table.usage-report th:nth-child(11), table.usage-report td:nth-child(11) { width: 6%; text-align: center; } /* Days With Consumption */
        
        /* Stock Report (10 columns) */
        table.stock-report th:nth-child(1), table.stock-report td:nth-child(1) { width: 18%; text-align: left; font-weight: 600; } /* Material Name */
        table.stock-report th:nth-child(2), table.stock-report td:nth-child(2) { width: 12%; text-align: center; } /* SKU */
        table.stock-report th:nth-child(3), table.stock-report td:nth-child(3) { width: 10%; text-align: center; } /* Category */
        table.stock-report th:nth-child(4), table.stock-report td:nth-child(4) { width: 10%; text-align: right; font-weight: 600; } /* Current Stock */
        table.stock-report th:nth-child(5), table.stock-report td:nth-child(5) { width: 9%; text-align: right; } /* Safety Stock */
        table.stock-report th:nth-child(6), table.stock-report td:nth-child(6) { width: 9%; text-align: right; } /* Reorder Point */
        table.stock-report th:nth-child(7), table.stock-report td:nth-child(7) { width: 9%; text-align: right; } /* Max Level */
        table.stock-report th:nth-child(8), table.stock-report td:nth-child(8) { width: 10%; text-align: right; } /* Unit Cost */
        table.stock-report th:nth-child(9), table.stock-report td:nth-child(9) { width: 11%; text-align: right; font-weight: 600; } /* Total Value */
        table.stock-report th:nth-child(10), table.stock-report td:nth-child(10) { width: 10%; text-align: center; font-weight: 600; } /* Status */
        
        /* Replenishment Report (10 columns) - Total: 100% */
        table.replenishment-report th:nth-child(1), table.replenishment-report td:nth-child(1) { width: 18%; text-align: left; font-weight: 600; } /* Material Name */
        table.replenishment-report th:nth-child(2), table.replenishment-report td:nth-child(2) { width: 10%; text-align: center; } /* Category */
        table.replenishment-report th:nth-child(3), table.replenishment-report td:nth-child(3) { width: 9%; text-align: right; font-weight: 600; } /* Current Stock */
        table.replenishment-report th:nth-child(4), table.replenishment-report td:nth-child(4) { width: 9%; text-align: right; } /* Reorder Point */
        table.replenishment-report th:nth-child(5), table.replenishment-report td:nth-child(5) { width: 10%; text-align: right; } /* Recommended Quantity */
        table.replenishment-report th:nth-child(6), table.replenishment-report td:nth-child(6) { width: 8%; text-align: center; } /* Days Until Reorder */
        table.replenishment-report th:nth-child(7), table.replenishment-report td:nth-child(7) { width: 8%; text-align: center; } /* Priority */
        table.replenishment-report th:nth-child(8), table.replenishment-report td:nth-child(8) { width: 10%; text-align: center; font-weight: 600; } /* Status */
        table.replenishment-report th:nth-child(9), table.replenishment-report td:nth-child(9) { width: 9%; text-align: right; } /* Unit Cost */
        table.replenishment-report th:nth-child(10), table.replenishment-report td:nth-child(10) { width: 9%; text-align: right; font-weight: 600; } /* Estimated Cost */
        
        /* Default fallback for other reports */
        table.default-report th, table.default-report td {
            width: auto;
        }
        
        /* Number formatting */
        .number-cell {
            text-align: right;
            font-family: 'Courier New', monospace;
        }
        
        /* Currency formatting */
        .currency-cell {
            text-align: right;
            font-family: 'Courier New', 'DejaVu Sans Mono', monospace;
        }
        
        /* Group separators - Usage Report */
        table.usage-report th:nth-child(3), table.usage-report td:nth-child(3),
        table.usage-report th:nth-child(4), table.usage-report td:nth-child(4) {
            border-left: 2px solid #34495e;
        }
        table.usage-report th:nth-child(6), table.usage-report td:nth-child(6) {
            border-left: 2px solid #34495e;
        }
        table.usage-report th:nth-child(8), table.usage-report td:nth-child(8) {
            border-left: 2px solid #34495e;
        }
        
        /* Group separators - Stock Report */
        table.stock-report th:nth-child(4), table.stock-report td:nth-child(4) {
            border-left: 2px solid #34495e;
        }
        table.stock-report th:nth-child(8), table.stock-report td:nth-child(8) {
            border-left: 2px solid #34495e;
        }
        table.stock-report th:nth-child(10), table.stock-report td:nth-child(10) {
            border-left: 2px solid #34495e;
        }
        
        /* Group separators - Replenishment Report */
        table.replenishment-report th:nth-child(3), table.replenishment-report td:nth-child(3) {
            border-left: 2px solid #34495e;
        }
        table.replenishment-report th:nth-child(8), table.replenishment-report td:nth-child(8) {
            border-left: 2px solid #34495e;
        }
        table.replenishment-report th:nth-child(9), table.replenishment-report td:nth-child(9) {
            border-left: 2px solid #34495e;
        }
        
        /* Status column styling - Simple and professional */
        .status-current {
            font-weight: 600;
            background-color: #f5f5f5;
            border-left: 2px solid #666 !important;
        }
        .status-projected {
            font-weight: 600;
            background-color: #f5f5f5;
            border-left: 2px solid #666 !important;
        }
        .status-out-of-stock {
            color: #333;
            font-weight: 600;
            background-color: #f5f5f5;
            text-align: center !important;
        }
        .status-critical {
            color: #333;
            font-weight: 600;
            background-color: #f5f5f5;
            text-align: center !important;
        }
        .status-low-stock {
            color: #333;
            font-weight: 600;
            background-color: #f5f5f5;
            text-align: center !important;
        }
        .status-overstocked {
            color: #333;
            font-weight: 600;
            background-color: #f5f5f5;
            text-align: center !important;
        }
        .status-in-stock {
            color: #333;
            font-weight: 600;
            background-color: #f5f5f5;
            text-align: center !important;
        }
        
        /* Negative number styling for projected stock - Simple */
        .negative-value {
            color: #333;
            font-weight: 600;
        }
        
        /* Usage report specific - keep it simple */
        table.usage-report .negative-value {
            color: #333;
            font-weight: 600;
        }
        
        /* Section headers for better organization */
        .section-header {
            background-color: #34495e;
            color: #ffffff;
            font-weight: bold;
            text-align: center;
            padding: 4px;
            font-size: 7pt;
        }
        
        /* Better spacing */
        tbody tr {
            page-break-inside: avoid;
        }
        
        /* Highlight important columns */
        .important-value {
            font-weight: 600;
            font-size: 8.5pt;
        }
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 8pt;
            color: #666;
            padding: 10px;
            border-top: 1px solid #ccc;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-container">
            <div class="logo-wrapper">
                <div class="logo-circle">
                    <span class="logo-text">UNICK</span>
                </div>
            </div>
        </div>
        <div class="header-text">
            <h1 class="header-title">UNICK FURNITURE</h1>
            <p class="header-subtitle">Automated Operational Reports</p>
        </div>
    </div>

    <div class="report-info">
        <table>
            <tr>
                <td>Report Type:</td>
                <td>{{ $reportType ?? 'Inventory Report' }}</td>
            </tr>
            <tr>
                <td>Generated Date:</td>
                <td>{{ now()->format('F d, Y h:i A') }}</td>
            </tr>
            @if(isset($dateRange))
            <tr>
                <td>Date Range:</td>
                <td>{{ $dateRange['start'] ?? 'N/A' }} to {{ $dateRange['end'] ?? 'N/A' }}</td>
            </tr>
            @endif
        </table>
    </div>

    @if(isset($data) && is_array($data) && count($data) > 0)
        @php
            $columnCount = count(array_keys($data[0]));
            $isUsageReport = $columnCount == 11 || (isset($data[0]['Projected Usage (30 days)']) || isset($data[0]['Projected Stock (30 days)']));
            $isStockReport = $columnCount == 10 || (isset($data[0]['SKU']) && isset($data[0]['Unit Cost']));
            $isReplenishmentReport = $columnCount == 10 && (isset($data[0]['Recommended Quantity']) || isset($data[0]['Days Until Reorder']));
        @endphp
        <table class="{{ $isUsageReport ? 'usage-report' : ($isStockReport ? 'stock-report' : ($isReplenishmentReport ? 'replenishment-report' : 'default-report')) }}">
            <thead>
                <tr>
                    @foreach(array_keys($data[0]) as $header)
                        @php
                            $headerText = ucwords(str_replace('_', ' ', $header));
                            // Format header text for better readability
                            $headerText = str_replace('(30 Days)', '(30 Days)', $headerText);
                            $headerText = str_replace('(30 days)', '(30 Days)', $headerText);
                        @endphp
                        <th>{{ $headerText }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach($data as $row)
                    <tr>
                        @foreach($row as $key => $cell)
                            @php
                                $cellValue = $cell ?? 'N/A';
                                $statusClass = '';
                                $numberClass = '';
                                $cellAlign = '';
                                
                                // Determine if this is a number column
                                $isNumber = false;
                                $isCurrency = false;
                                $numberKeys = ['Average Daily Consumption', 'Current Stock', 'Projected Usage', 'Projected Stock', 'Total Consumption', 'Days Until Stockout', 'Safety Stock', 'Reorder Point', 'Max Level', 'Unit Cost', 'Total Value'];
                                $currencyKeys = ['Estimated Cost'];
                                
                                foreach ($numberKeys as $numKey) {
                                    if (stripos($key, $numKey) !== false) {
                                        $isNumber = true;
                                        $numberClass = 'number-cell';
                                        
                                        // Clean any currency symbols from Unit Cost and Total Value
                                        if (stripos($key, 'Unit Cost') !== false || stripos($key, 'Total Value') !== false) {
                                            // Remove any existing currency symbols (₱, P, ?, or HTML entity)
                                            $cleanValue = preg_replace('/[₱P?]|&#8369;|&#x20B1;/u', '', $cellValue);
                                            // Remove commas for processing
                                            $cleanValue = str_replace(',', '', $cleanValue);
                                            
                                            if (is_numeric($cleanValue) && $cleanValue !== '') {
                                                $numValue = floatval($cleanValue);
                                                // Format number with commas but no currency symbol
                                                $cellValue = number_format($numValue, 2);
                                            } elseif (!empty($cellValue) && $cellValue !== 'N/A' && $cellValue !== '') {
                                                // Try to extract number from already formatted value
                                                $cleanValue = preg_replace('/[^0-9.-]/', '', $cellValue);
                                                if (is_numeric($cleanValue) && $cleanValue !== '') {
                                                    $cellValue = number_format(floatval($cleanValue), 2);
                                                } else {
                                                    $cellValue = '0.00';
                                                }
                                            } else {
                                                $cellValue = '0.00';
                                            }
                                        }
                                        break;
                                    }
                                }
                                
                                foreach ($currencyKeys as $currKey) {
                                    if (stripos($key, $currKey) !== false) {
                                        $isCurrency = true;
                                        $numberClass = 'currency-cell';
                                        
                                        // Remove any existing currency symbols (₱, P, ?, or HTML entity)
                                        $cleanValue = preg_replace('/[₱P?]|&#8369;|&#x20B1;|&#8369;/u', '', $cellValue);
                                        
                                        // Remove commas and any other non-numeric characters except decimal point and minus
                                        $cleanValue = preg_replace('/[^0-9.-]/', '', $cleanValue);
                                        
                                        // Handle numeric values - Use actual peso symbol with UTF-8
                                        if (is_numeric($cleanValue) && $cleanValue !== '') {
                                            $numValue = floatval($cleanValue);
                                            // Use actual peso symbol (₱) with UTF-8 encoding and format with commas
                                            $cellValue = '&#8369; ' . number_format($numValue, 2);
                                        } elseif (!empty($cellValue) && $cellValue !== 'N/A' && $cellValue !== '') {
                                            // Try to extract number from already formatted value (handles comma-separated numbers)
                                            $cleanValue = preg_replace('/[^0-9.-]/', '', $cellValue);
                                            if (is_numeric($cleanValue) && $cleanValue !== '') {
                                                $cellValue = '&#8369; ' . number_format(floatval($cleanValue), 2);
                                            } else {
                                                // If still not numeric, ensure we have a valid number
                                                $cellValue = '&#8369; 0.00';
                                            }
                                        } else {
                                            // Default for N/A or empty
                                            $cellValue = '&#8369; 0.00';
                                        }
                                        break;
                                    }
                                }
                                
                                // Apply status styling
                                if (stripos($key, 'Current Status') !== false || stripos($key, 'current status') !== false) {
                                    $statusClass = 'status-current ';
                                    if (stripos($cellValue, 'Out of Stock') !== false) {
                                        $statusClass .= 'status-out-of-stock';
                                    } elseif (stripos($cellValue, 'Critical') !== false) {
                                        $statusClass .= 'status-critical';
                                    } elseif (stripos($cellValue, 'Low Stock') !== false) {
                                        $statusClass .= 'status-low-stock';
                                    } elseif (stripos($cellValue, 'Overstocked') !== false) {
                                        $statusClass .= 'status-overstocked';
                                    } elseif (stripos($cellValue, 'In Stock') !== false) {
                                        $statusClass .= 'status-in-stock';
                                    }
                                } elseif (stripos($key, 'Projected Status') !== false || stripos($key, 'projected status') !== false) {
                                    $statusClass = 'status-projected ';
                                    if (stripos($cellValue, 'Out of Stock') !== false) {
                                        $statusClass .= 'status-out-of-stock';
                                    } elseif (stripos($cellValue, 'Critical') !== false) {
                                        $statusClass .= 'status-critical';
                                    } elseif (stripos($cellValue, 'Low Stock') !== false) {
                                        $statusClass .= 'status-low-stock';
                                    } elseif (stripos($cellValue, 'Overstocked') !== false) {
                                        $statusClass .= 'status-overstocked';
                                    } elseif (stripos($cellValue, 'In Stock') !== false) {
                                        $statusClass .= 'status-in-stock';
                                    }
                                } elseif (stripos($key, 'Category') !== false || stripos($key, 'Days With Consumption') !== false || stripos($key, 'Days Until Stockout') !== false) {
                                    $cellAlign = 'text-align: center;';
                                }
                                
                                // Format negative numbers for projected stock
                                if (stripos($key, 'Projected Stock') !== false) {
                                    $cleanValue = str_replace(',', '', $cellValue);
                                    if (is_numeric($cleanValue)) {
                                        $numValue = floatval($cleanValue);
                                        if ($numValue < 0) {
                                            $cellValue = number_format($numValue, 2);
                                            $numberClass .= ' negative-value';
                                        }
                                    }
                                }
                                
                                // Add important value class for key metrics
                                $importantKeys = ['Current Stock', 'Projected Stock', 'Current Status', 'Projected Status', 'Status', 'Total Value'];
                                foreach ($importantKeys as $impKey) {
                                    if (stripos($key, $impKey) !== false) {
                                        $numberClass .= ' important-value';
                                        break;
                                    }
                                }
                                
                                // Apply status styling for Status column (Stock Report)
                                if (stripos($key, 'Status') !== false && stripos($key, 'Current Status') === false && stripos($key, 'Projected Status') === false) {
                                    if (stripos($cellValue, 'Out of Stock') !== false) {
                                        $statusClass .= 'status-out-of-stock';
                                    } elseif (stripos($cellValue, 'Critical') !== false) {
                                        $statusClass .= 'status-critical';
                                    } elseif (stripos($cellValue, 'Low Stock') !== false) {
                                        $statusClass .= 'status-low-stock';
                                    } elseif (stripos($cellValue, 'Overstocked') !== false) {
                                        $statusClass .= 'status-overstocked';
                                    } elseif (stripos($cellValue, 'In Stock') !== false) {
                                        $statusClass .= 'status-in-stock';
                                    }
                                }
                                
                                // Center align SKU and Category
                                if (stripos($key, 'SKU') !== false || stripos($key, 'Category') !== false) {
                                    $cellAlign = 'text-align: center;';
                                }
                            @endphp
                            <td class="{{ $statusClass }} {{ $numberClass }}" style="{{ $cellAlign }}">{!! $cellValue !!}</td>
                        @endforeach
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p>No data available for this report.</p>
    @endif

    <div class="footer">
        <p>Generated by UNICK Furniture Automated Reporting System | Page <span class="page-number"></span></p>
    </div>
</body>
</html>

