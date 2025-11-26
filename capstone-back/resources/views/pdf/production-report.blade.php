<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Production Report - UNICK Furniture</title>
    <style>
        @page {
            margin: 20mm;
        }
        body {
            font-family: Arial, sans-serif;
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
        }
        th {
            background-color: #f0f0f0;
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 9pt;
        }
        td {
            border: 1px solid #000;
            padding: 6px;
            font-size: 9pt;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
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
        .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 10px;
            padding: 8px;
            background-color: #e0e0e0;
            border-left: 4px solid #000;
        }
        .key-value-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .key-value-table td {
            border: 1px solid #ddd;
            padding: 6px 10px;
            font-size: 9pt;
        }
        .key-value-table td:first-child {
            font-weight: bold;
            background-color: #f5f5f5;
            width: 40%;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 8pt;
        }
        .data-table th {
            background-color: #333;
            color: #fff;
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            font-weight: bold;
        }
        .data-table td {
            border: 1px solid #ddd;
            padding: 5px;
        }
        .data-table tr:nth-child(even) {
            background-color: #f9f9f9;
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
                <td>{{ $reportType ?? 'Production Report' }}</td>
            </tr>
            <tr>
                <td>Generated Date:</td>
                <td>{{ now()->format('F d, Y h:i A') }}</td>
            </tr>
            @if(isset($dateRange) && $dateRange)
            <tr>
                <td>Date Range:</td>
                <td>{{ $dateRange['start'] ?? 'N/A' }} to {{ $dateRange['end'] ?? 'N/A' }}</td>
            </tr>
            @else
            <tr>
                <td>Date Range:</td>
                <td>All Time</td>
            </tr>
            @endif
            @if(isset($categoryFilter) && $categoryFilter !== 'all')
            <tr>
                <td>Category Filter:</td>
                <td>{{ $categoryFilter === 'alkansya' ? 'Alkansya' : ($categoryFilter === 'made_to_order' ? 'Made to Order' : ucfirst($categoryFilter)) }}</td>
            </tr>
            @endif
            @if(isset($statusFilter) && $statusFilter !== 'all')
            <tr>
                <td>Status Filter:</td>
                <td>{{ ucfirst(str_replace('_', ' ', $statusFilter)) }}</td>
            </tr>
            @endif
        </table>
    </div>

    @if(isset($reportData) && isset($reportData['sections']) && is_array($reportData['sections']))
        @foreach($reportData['sections'] as $section)
            <div class="section">
                <div class="section-title">{{ $section['title'] ?? 'Section' }}</div>
                
                @if(isset($section['type']) && $section['type'] === 'table' && isset($section['headers']) && isset($section['data']))
                    {{-- Table Section --}}
                    <table class="data-table">
                        <thead>
                            <tr>
                                @foreach($section['headers'] as $header)
                                    <th>{{ $header }}</th>
                                @endforeach
                            </tr>
                        </thead>
                        <tbody>
                            @if(isset($section['data']) && is_array($section['data']) && count($section['data']) > 0)
                                @foreach($section['data'] as $row)
                                    <tr>
                                        @if(is_array($row))
                                            @foreach($row as $cell)
                                                <td>{{ $cell ?? 'N/A' }}</td>
                                            @endforeach
                                        @else
                                            <td>{{ $row ?? 'N/A' }}</td>
                                        @endif
                                    </tr>
                                @endforeach
                            @else
                                <tr>
                                    <td colspan="{{ count($section['headers']) }}" style="text-align: center; padding: 20px;">
                                        No data available
                                    </td>
                                </tr>
                            @endif
                        </tbody>
                    </table>
                @elseif(isset($section['type']) && $section['type'] === 'key-value' && isset($section['data']))
                    {{-- Key-Value Section --}}
                    <table class="key-value-table">
                        <tbody>
                            @if(isset($section['data']) && is_array($section['data']) && count($section['data']) > 0)
                                @foreach($section['data'] as $item)
                                    <tr>
                                        <td>{{ $item['label'] ?? 'N/A' }}</td>
                                        <td>{{ $item['value'] ?? 'N/A' }}</td>
                                    </tr>
                                @endforeach
                            @else
                                <tr>
                                    <td colspan="2" style="text-align: center; padding: 20px;">
                                        No data available
                                    </td>
                                </tr>
                            @endif
                        </tbody>
                    </table>
                @elseif(isset($section['data']) && is_array($section['data']))
                    {{-- Default: Key-Value format --}}
                    <table class="key-value-table">
                        <tbody>
                            @foreach($section['data'] as $item)
                                <tr>
                                    <td>{{ $item['label'] ?? 'N/A' }}</td>
                                    <td>{{ $item['value'] ?? 'N/A' }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif
            </div>
        @endforeach
    @elseif(isset($data) && is_array($data) && count($data) > 0)
        {{-- Fallback to old format for backward compatibility --}}
        <table>
            <thead>
                <tr>
                    @foreach(array_keys($data[0]) as $header)
                        <th>{{ ucwords(str_replace('_', ' ', $header)) }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach($data as $row)
                    <tr>
                        @foreach($row as $cell)
                            <td>{{ $cell ?? 'N/A' }}</td>
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

